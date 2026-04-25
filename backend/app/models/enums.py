"""Enums obrigatórios pelo desafio.

Persistidos como `String` (não `pg.ENUM`) para evitar bugs do alembic autogenerate
com Enums em Postgres (não gera DROP TYPE / ALTER TYPE ADD VALUE corretamente).
A validação fica na camada Pydantic/SQLModel.
"""

from enum import Enum


class LeadStatus(str, Enum):
    NEW = "new"
    QUALIFIED = "qualified"
    NEEDS_HUMAN = "needs_human"
    OPT_OUT = "opt_out"


class ServiceInterest(str, Enum):
    CONTACT_Z = "contact_z"
    CONTACT_TEL = "contact_tel"
    MAILING = "mailing"
    DATA_ENRICHMENT = "data_enrichment"
    UNKNOWN = "unknown"


class Intent(str, Enum):
    CONTACT_Z = "contact_z"
    CONTACT_TEL = "contact_tel"
    MAILING = "mailing"
    DATA_ENRICHMENT = "data_enrichment"
    PRICING = "pricing"
    HUMAN_HANDOFF = "human_handoff"
    OPT_OUT = "opt_out"
    SUPPORT = "support"
    GENERAL_QUESTION = "general_question"


class Direction(str, Enum):
    IN = "in"
    OUT = "out"


class MessageType(str, Enum):
    TEXT = "text"
    AUDIO = "audio"
    IMAGE = "image"


class MessageStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"
    RECEIVED = "received"


__all__ = [
    "LeadStatus",
    "ServiceInterest",
    "Intent",
    "Direction",
    "MessageType",
    "MessageStatus",
]
