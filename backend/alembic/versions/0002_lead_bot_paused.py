"""add Lead.bot_paused (handoff humano)

Revision ID: 0002_lead_bot_paused
Revises: 0001_init
Create Date: 2026-04-25 19:30:00

Adiciona a coluna `bot_paused` em `leads` (default False, NOT NULL). Quando True,
o orchestrator NÃO chama IA — só persiste a mensagem recebida e emite no Socket.IO,
deixando humano responder via UI.

Migration escrita à mão (autogenerate é evitado neste projeto por causa de bugs
com Postgres ENUM — mantemos consistência).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002_lead_bot_paused"
down_revision: str | Sequence[str] | None = "0001_init"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "leads",
        sa.Column(
            "bot_paused",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("leads", "bot_paused")
