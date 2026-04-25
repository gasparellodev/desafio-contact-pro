"""Buffer Redis com debounce para mensagens consecutivas do WhatsApp.

Por que existe: lead que manda 3 mensagens em < 5s gera 3 chamadas de IA
(caro + respostas fora de contexto agregado). Esta camada agrega:

```
webhook recebe M1 → persist Message IN → enqueue(M1) → SET deadline=NOW+5s
webhook recebe M2 → persist Message IN → enqueue(M2) → RESET deadline=NOW+5s
webhook recebe M3 → persist Message IN → enqueue(M3) → RESET deadline=NOW+5s
                       (cliente para de digitar)
worker tick (1s)   → deadline expirou → LRANGE [M1, M2, M3] → DEL → process_batch
                       → 1 só AI call com texto agregado → 1 só resposta
```

Idempotência: se worker crashar entre LRANGE e DEL, próximo tick reprocessa
as mesmas mensagens. Defesa: `Message.processed_at` filtra mensagens já
respondidas no `process_batch` do orchestrator.

Persistência: Redis sobrevive a restart do backend (deadline e buffer ficam
no Redis até o worker pegar).
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from redis.asyncio import Redis

logger = logging.getLogger(__name__)

# Chaves Redis. Usamos TTL generoso (60s) só pra garbage collect — a real
# decisão de "vencido" é por comparação com o timestamp armazenado em VALUE.
BUFFER_KEY = "buffer:conv:{conv_id}"
DEADLINE_KEY = "buffer-deadline:conv:{conv_id}"
DEADLINE_TTL_SECONDS = 60  # safety net contra leak se DEL falhar


async def enqueue(
    redis: Redis,
    *,
    conversation_id: str,
    message_id: str,
    debounce_seconds: int = 5,
) -> None:
    """Adiciona message_id ao buffer da conversa e (re)agenda processamento.

    `LPUSH` é O(1). Cada chamada RESETA a deadline — chegou nova mensagem,
    aguardar mais `debounce_seconds` antes de processar.
    """
    buffer_key = BUFFER_KEY.format(conv_id=conversation_id)
    deadline_key = DEADLINE_KEY.format(conv_id=conversation_id)
    deadline_at = time.time() + debounce_seconds

    pipe = redis.pipeline()
    pipe.lpush(buffer_key, message_id)
    pipe.expire(buffer_key, DEADLINE_TTL_SECONDS)
    pipe.set(deadline_key, str(deadline_at), ex=DEADLINE_TTL_SECONDS)
    await pipe.execute()


async def flush_due(redis: Redis) -> list[tuple[str, list[str]]]:
    """Retorna as conversas cujo deadline expirou, com seus message_ids.

    Para cada uma: LRANGE + DEL atômico via pipeline. Se o worker crashar
    entre LRANGE e DEL, o próximo tick re-lê a mesma lista (mas o orchestrator
    filtra `Message.processed_at IS NULL` para evitar reprocessamento).

    Retorno: lista de `(conversation_id, [message_id, ...])` em ordem
    cronológica (mensagem mais antiga primeiro).
    """
    now = time.time()
    batches: list[tuple[str, list[str]]] = []

    # SCAN é cursor-based — escala melhor que KEYS em produção.
    async for key_b in redis.scan_iter(match=DEADLINE_KEY.format(conv_id="*"), count=100):
        key = key_b.decode() if isinstance(key_b, bytes) else key_b
        deadline_str = await redis.get(key)
        if deadline_str is None:
            continue
        try:
            deadline = float(deadline_str)
        except (TypeError, ValueError):
            await redis.delete(key)
            continue
        if deadline > now:
            continue  # ainda dentro da janela de debounce

        # Deadline expirou — extrai e processa.
        conv_id = key.split(":conv:", 1)[1]
        buffer_key = BUFFER_KEY.format(conv_id=conv_id)
        # LRANGE retorna LIFO; revertemos para ordem cronológica.
        ids_b = await redis.lrange(buffer_key, 0, -1)
        if not ids_b:
            await redis.delete(key)
            continue
        message_ids = [
            (mid.decode() if isinstance(mid, bytes) else mid)
            for mid in reversed(ids_b)
        ]
        # DEL atômico do par.
        pipe = redis.pipeline()
        pipe.delete(buffer_key)
        pipe.delete(key)
        await pipe.execute()
        batches.append((conv_id, message_ids))

    return batches


async def buffer_worker(
    redis: Redis,
    *,
    process_batch: Callable[[str, list[str]], Awaitable[None]],
    tick_seconds: float = 1.0,
) -> None:
    """Loop infinito que varre deadlines a cada `tick_seconds`.

    `process_batch(conversation_id, message_ids)` é o callback assíncrono
    que recebe cada batch pronto. O orchestrator implementa esse callback —
    carrega Messages do DB filtrando `processed_at IS NULL` e dispara o
    pipeline de IA.

    Erros do callback NÃO interrompem o worker (loga e segue). Cancelamento
    via `task.cancel()` propaga via CancelledError.
    """
    logger.info("buffer_worker_started", extra={"tick_seconds": tick_seconds})
    try:
        while True:
            try:
                batches = await flush_due(redis)
                for conv_id, message_ids in batches:
                    try:
                        await process_batch(conv_id, message_ids)
                    except Exception as exc:  # noqa: BLE001
                        logger.exception(
                            "buffer_batch_failed",
                            extra={
                                "conversation_id": conv_id,
                                "count": len(message_ids),
                                "error_class": exc.__class__.__name__,
                            },
                        )
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    "buffer_worker_tick_failed",
                    extra={"error_class": exc.__class__.__name__},
                )
            await asyncio.sleep(tick_seconds)
    except asyncio.CancelledError:
        logger.info("buffer_worker_cancelled")
        raise
