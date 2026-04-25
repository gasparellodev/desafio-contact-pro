#!/usr/bin/env bash
set -euo pipefail

# wait_for_db.py é executado para garantir que o Postgres está pronto.
# docker-compose também usa healthcheck no serviço db, mas mantemos defesa em profundidade.
echo "[entrypoint] aguardando Postgres ficar disponível..."
uv run python -m app.scripts.wait_for_db || true

echo "[entrypoint] aplicando migrations (alembic upgrade head)..."
uv run alembic upgrade head || echo "[entrypoint] alembic falhou ou ainda não há migrations — seguindo."

echo "[entrypoint] iniciando uvicorn em 0.0.0.0:8000"
exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers
