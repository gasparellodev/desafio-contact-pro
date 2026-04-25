from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.socketio import sio

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    yield


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


# Socket.IO ASGI root: NÃO usar fastapi_app.mount(); o pattern correto é envelopar.
app = socketio.ASGIApp(sio, fastapi_app, socketio_path="socket.io")
