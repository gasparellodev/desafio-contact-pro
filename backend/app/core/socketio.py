from typing import Any

import socketio

from app.core.config import get_settings

settings = get_settings()

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.socket_cors_origins_list,
    logger=False,
    engineio_logger=False,
)


@sio.event
async def connect(sid: str, environ: dict, auth: dict | None = None) -> None:  # noqa: ARG001
    await sio.enter_room(sid, "global")


@sio.event
async def join_conversation(sid: str, data: dict) -> None:
    conversation_id = data.get("conversation_id")
    if conversation_id:
        await sio.enter_room(sid, f"conversation:{conversation_id}")


@sio.event
async def leave_conversation(sid: str, data: dict) -> None:
    conversation_id = data.get("conversation_id")
    if conversation_id:
        await sio.leave_room(sid, f"conversation:{conversation_id}")


async def emit_global(event: str, data: dict[str, Any]) -> None:
    await sio.emit(event, data, room="global")


async def emit_to_conversation(conversation_id: str, event: str, data: dict[str, Any]) -> None:
    await sio.emit(event, data, room=f"conversation:{conversation_id}")
    await sio.emit(event, data, room="global")
