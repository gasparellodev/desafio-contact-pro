"""add Message.processed_at (idempotência do buffer worker)

Revision ID: 0003_message_processed_at
Revises: 0002_lead_bot_paused
Create Date: 2026-04-25 19:50:00

Adiciona `Message.processed_at: datetime | None`. NULL = ainda não processado.
Worker que consome o buffer Redis filtra `WHERE processed_at IS NULL` antes de
chamar a AI — protege contra reprocessamento se worker crashar entre LRANGE e
DEL no Redis (pode ler a mesma mensagem 2x; idempotência via DB resolve).

Index em (conversation_id, processed_at) acelera o "load batch pra processar".
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003_message_processed_at"
down_revision: str | Sequence[str] | None = "0002_lead_bot_paused"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_messages_conv_processed",
        "messages",
        ["conversation_id", "processed_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_messages_conv_processed", table_name="messages")
    op.drop_column("messages", "processed_at")
