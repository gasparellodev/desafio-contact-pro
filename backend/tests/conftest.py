"""Fixtures de teste compartilhadas.

Estratégia mínima do Spec A:
- 1 container Postgres (testcontainers) por sessão pytest;
- `SQLModel.metadata.create_all` no startup, sem migrations Alembic;
- truncate das tabelas após cada teste para isolamento rápido;
- httpx.AsyncClient via ASGITransport contra a app, com `get_session`
  sobrescrito para usar o engine do container.

Spec B vai expandir com factory-boy, mocks de Evolution/OpenAI/Anthropic etc.
"""

from __future__ import annotations

import os

# Defaults de env ANTES de qualquer import do app (Settings é lru_cache).
os.environ.setdefault("ADMIN_API_TOKEN", "test-admin-token")
os.environ.setdefault("EVOLUTION_API_KEY", "test-evo-key")
# Database real é injetado via fixture; este placeholder evita validação falhar.
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://placeholder:placeholder@localhost/placeholder"
)
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")

from collections.abc import AsyncIterator  # noqa: E402

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool  # noqa: E402
from sqlmodel import SQLModel  # noqa: E402
from testcontainers.postgres import PostgresContainer  # noqa: E402

import app.db.base  # noqa: F401, E402  — registra modelos na metadata
from app.api.deps import get_session  # noqa: E402
from app.main import fastapi_app  # noqa: E402

ADMIN_TOKEN = "test-admin-token"


@pytest.fixture(scope="session")
def postgres_container():
    """Sobe um Postgres real para a sessão inteira de testes (~3-5s startup)."""
    with PostgresContainer("postgres:16-alpine", driver="asyncpg") as pg:
        yield pg


@pytest.fixture(scope="session")
def postgres_url(postgres_container) -> str:
    return postgres_container.get_connection_url()


@pytest_asyncio.fixture
async def engine(postgres_url: str) -> AsyncIterator[AsyncEngine]:
    """Engine async por teste (NullPool, sem cross-loop pain).

    `SQLModel.metadata.create_all` é idempotente e barato sobre Postgres já
    inicializado; TRUNCATE no início garante isolamento entre testes.
    """
    eng = create_async_engine(postgres_url, future=True, echo=False, poolclass=NullPool)
    async with eng.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
        await conn.execute(
            text("TRUNCATE TABLE messages, conversations, leads RESTART IDENTITY CASCADE")
        )
    try:
        yield eng
    finally:
        await eng.dispose()


@pytest_asyncio.fixture
async def session(engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    Maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Maker() as s:
        yield s


@pytest_asyncio.fixture
async def client(engine: AsyncEngine) -> AsyncIterator[AsyncClient]:
    """HTTP client com `get_session` override apontando para o engine de teste."""
    Maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async def _override_get_session() -> AsyncIterator[AsyncSession]:
        async with Maker() as s:
            yield s

    fastapi_app.dependency_overrides[get_session] = _override_get_session
    try:
        transport = ASGITransport(app=fastapi_app)
        async with AsyncClient(
            transport=transport,
            base_url="http://test",
            headers={"X-Admin-Token": ADMIN_TOKEN},
        ) as ac:
            yield ac
    finally:
        fastapi_app.dependency_overrides.pop(get_session, None)


@pytest.fixture
def admin_headers() -> dict[str, str]:
    return {"X-Admin-Token": ADMIN_TOKEN}
