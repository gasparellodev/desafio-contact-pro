import asyncio
import logging
from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import conversations, health, leads, webhooks, whatsapp
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.redis import close_redis, get_redis
from app.core.socketio import sio
from app.db.session import SessionLocal
from app.services.conversation_orchestrator import ConversationOrchestrator
from app.services.message_buffer import buffer_worker

settings = get_settings()
logger = logging.getLogger(__name__)


async def _process_batch_callback(conversation_id: str, message_ids: list[str]) -> None:
    """Callback chamado pelo buffer_worker quando uma deadline expira.

    Cria sessão DB nova por batch (não compartilha entre batches pra evitar
    contaminação de transação).
    """
    async with SessionLocal() as session:
        orchestrator = ConversationOrchestrator(session)
        await orchestrator.process_pending(conversation_id, message_ids)


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    # Worker do buffer Redis (D.2). Debounce hardcoded em
    # `services/message_buffer.DEBOUNCE_SECONDS` (5s).
    redis_client = get_redis()
    worker_task: asyncio.Task | None = asyncio.create_task(
        buffer_worker(redis_client, process_batch=_process_batch_callback)
    )
    logger.info("buffer_worker_scheduled")
    try:
        yield
    finally:
        if worker_task is not None:
            worker_task.cancel()
            try:
                await worker_task
            except asyncio.CancelledError:
                pass
        await close_redis()


fastapi_app = FastAPI(
    title="Contact Pro Backend",
    version="0.1.0",
    description="Chatbot WhatsApp + IA para atendimento de leads da Contact Pro.",
    lifespan=lifespan,
)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.socket_cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

fastapi_app.include_router(health.router)
fastapi_app.include_router(webhooks.router)
fastapi_app.include_router(whatsapp.router)
fastapi_app.include_router(conversations.router)
fastapi_app.include_router(leads.router)


# Socket.IO ASGI root: NÃO usar fastapi_app.mount(); o pattern correto é envelopar.
app = socketio.ASGIApp(sio, fastapi_app, socketio_path="socket.io")
