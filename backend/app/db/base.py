"""Importa todos os models para que SQLModel.metadata os enxergue ao gerar migrations."""

from sqlmodel import SQLModel  # noqa: F401

from app.models.conversation import Conversation  # noqa: F401
from app.models.lead import Lead  # noqa: F401
from app.models.message import Message  # noqa: F401
