"""init: Lead, Conversation, Message

Revision ID: 0001_init
Revises:
Create Date: 2026-04-25 11:25:00

Migração inicial criando as 3 tabelas do domínio:
- leads (PK uuid, whatsapp_jid UNIQUE)
- conversations (FK→leads, ondelete cascade)
- messages (FK→conversations, whatsapp_message_id UNIQUE para idempotência)

Enums armazenados como VARCHAR para evitar bugs do autogenerate com pg.ENUM.
"""
from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
import sqlmodel  # noqa: F401  (necessário para AutoString se usado em models)
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001_init"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "leads",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("whatsapp_jid", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=True),
        sa.Column("company", sa.String(length=200), nullable=True),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column(
            "service_interest",
            sa.String(length=32),
            nullable=False,
            server_default="unknown",
        ),
        sa.Column("lead_goal", sa.String(length=500), nullable=True),
        sa.Column("estimated_volume", sa.String(length=160), nullable=True),
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default="new",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_leads_whatsapp_jid", "leads", ["whatsapp_jid"], unique=True)
    op.create_index("ix_leads_status", "leads", ["status"], unique=False)

    op.create_table(
        "conversations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "lead_id",
            UUID(as_uuid=True),
            sa.ForeignKey("leads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("last_intent", sa.String(length=32), nullable=True),
        sa.Column(
            "last_message_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_conversations_lead_id", "conversations", ["lead_id"], unique=False)

    op.create_table(
        "messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "conversation_id",
            UUID(as_uuid=True),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("whatsapp_message_id", sa.String(length=128), nullable=True),
        sa.Column("direction", sa.String(length=8), nullable=False),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("transcription", sa.Text(), nullable=True),
        sa.Column("media_url", sa.String(length=512), nullable=True),
        sa.Column("media_mime", sa.String(length=64), nullable=True),
        sa.Column("intent", sa.String(length=32), nullable=True),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("quoted_message_id", UUID(as_uuid=True), nullable=True),
        sa.Column("error_reason", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_messages_whatsapp_message_id",
        "messages",
        ["whatsapp_message_id"],
        unique=True,
    )
    op.create_index(
        "ix_messages_conversation_id",
        "messages",
        ["conversation_id"],
        unique=False,
    )
    op.create_index("ix_messages_direction", "messages", ["direction"], unique=False)
    op.create_index("ix_messages_created_at", "messages", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_messages_created_at", table_name="messages")
    op.drop_index("ix_messages_direction", table_name="messages")
    op.drop_index("ix_messages_conversation_id", table_name="messages")
    op.drop_index("ix_messages_whatsapp_message_id", table_name="messages")
    op.drop_table("messages")

    op.drop_index("ix_conversations_lead_id", table_name="conversations")
    op.drop_table("conversations")

    op.drop_index("ix_leads_status", table_name="leads")
    op.drop_index("ix_leads_whatsapp_jid", table_name="leads")
    op.drop_table("leads")
