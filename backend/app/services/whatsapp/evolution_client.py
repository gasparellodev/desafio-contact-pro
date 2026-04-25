"""Cliente HTTP assíncrono para Evolution API v2.x.

Centraliza:
- header `apikey:` (única fonte; nunca espalhar pelo código)
- retries em 5xx/429 via tenacity
- timeouts conservadores
- payloads tipados via Pydantic

Endpoints cobertos:
- POST /instance/create
- GET  /instance/connect/{instance}
- GET  /instance/connectionState/{instance}
- POST /webhook/set/{instance}
- POST /message/sendText/{instance}
- POST /message/sendWhatsAppAudio/{instance}
- POST /message/sendReaction/{instance}
- POST /chat/getBase64FromMediaMessage/{instance}
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class EvolutionAPIError(RuntimeError):
    """Erro ao falar com a Evolution API."""


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in (408, 429, 500, 502, 503, 504)
    return isinstance(exc, httpx.TransportError | httpx.ReadTimeout)


class EvolutionClient:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.base_url = self.settings.evolution_api_url.rstrip("/")
        self.instance = self.settings.evolution_instance
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(20.0, connect=5.0),
            headers={"apikey": self.settings.evolution_api_key},
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    @retry(
        retry=retry_if_exception_type((httpx.TransportError, EvolutionAPIError)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
        reraise=True,
    )
    async def _request(
        self, method: str, path: str, *, json: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        try:
            resp = await self._client.request(method, url, json=json)
        except httpx.TransportError as exc:
            logger.warning("evolution_transport_error", extra={"url": url, "error": str(exc)})
            raise

        if resp.status_code >= 500 or resp.status_code == 429:
            raise EvolutionAPIError(f"{method} {path} → {resp.status_code} {resp.text[:200]}")

        if resp.status_code >= 400:
            # 4xx são definitivos — não retentar
            logger.error(
                "evolution_4xx",
                extra={"url": url, "status": resp.status_code, "body": resp.text[:300]},
            )
            raise EvolutionAPIError(f"{method} {path} → {resp.status_code} {resp.text[:200]}")

        return resp.json() if resp.content else {}

    # ===== Instance management =====

    async def create_instance(self) -> dict[str, Any]:
        """Cria a instância (idempotente: se já existe, retorna o erro 4xx — capturado externamente)."""
        return await self._request(
            "POST",
            "/instance/create",
            json={
                "instanceName": self.instance,
                "qrcode": True,
                "integration": "WHATSAPP-BAILEYS",
            },
        )

    async def connect(self) -> dict[str, Any]:
        """Retorna QR code atual (refresh)."""
        return await self._request("GET", f"/instance/connect/{self.instance}")

    async def connection_state(self) -> dict[str, Any]:
        return await self._request("GET", f"/instance/connectionState/{self.instance}")

    async def logout(self) -> dict[str, Any]:
        return await self._request("DELETE", f"/instance/logout/{self.instance}")

    # ===== Webhook =====

    async def set_webhook(
        self,
        url: str,
        events: list[str] | None = None,
        base64: bool = True,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        events = events or [
            "MESSAGES_UPSERT",
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED",
            "SEND_MESSAGE",
        ]
        webhook_body: dict[str, Any] = {
            "enabled": True,
            "url": url,
            "byEvents": False,
            "base64": base64,
            "events": events,
        }
        # Evolution v2 não envia `apikey` automaticamente nas chamadas de webhook;
        # passamos via `headers` para o nosso backend conseguir validar a origem.
        if headers:
            webhook_body["headers"] = headers
        return await self._request(
            "POST",
            f"/webhook/set/{self.instance}",
            json={"webhook": webhook_body},
        )

    # ===== Send =====

    async def send_text(
        self,
        number: str,
        text: str,
        *,
        quoted: dict[str, Any] | None = None,
        delay_ms: int = 0,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"number": number, "text": text, "delay": delay_ms}
        if quoted:
            body["quoted"] = quoted
        return await self._request(
            "POST", f"/message/sendText/{self.instance}", json=body
        )

    async def send_audio(
        self,
        number: str,
        audio_base64: str,
        *,
        delay_ms: int = 0,
        encoding: bool = True,
    ) -> dict[str, Any]:
        """Envia voice note PTT. Aceita base64 (sem prefixo data:) ou URL.

        Evolution converte internamente via ffmpeg para audio/ogg; codecs=opus.
        """
        body = {
            "number": number,
            "audio": audio_base64,
            "delay": delay_ms,
            "encoding": encoding,
        }
        return await self._request(
            "POST", f"/message/sendWhatsAppAudio/{self.instance}", json=body
        )

    async def send_reaction(
        self,
        remote_jid: str,
        message_id: str,
        from_me: bool,
        emoji: str,
    ) -> dict[str, Any]:
        return await self._request(
            "POST",
            f"/message/sendReaction/{self.instance}",
            json={
                "key": {"remoteJid": remote_jid, "fromMe": from_me, "id": message_id},
                "reaction": emoji,
            },
        )

    # ===== Media download =====

    async def download_media_base64(self, message_key: dict[str, Any]) -> dict[str, Any]:
        """Baixa mídia (áudio/imagem) de uma mensagem.

        Body: { message: { key: { id, remoteJid, fromMe } } }
        Retorna: { mediatype, fileName, base64, mimetype }
        """
        return await self._request(
            "POST",
            f"/chat/getBase64FromMediaMessage/{self.instance}",
            json={"message": {"key": message_key}, "convertToMp4": False},
        )


_client: EvolutionClient | None = None


def get_evolution_client() -> EvolutionClient:
    """Singleton — chamado via Depends nas rotas e via importação no orchestrator."""
    global _client
    if _client is None:
        _client = EvolutionClient()
    return _client
