"""Aguarda o Postgres ficar pronto antes do uvicorn subir.

Executado pelo entrypoint.sh do Docker. Limita a espera a ~60s.
"""

import asyncio
import sys

import asyncpg

from app.core.config import get_settings


async def main() -> int:
    settings = get_settings()
    dsn = settings.database_url.replace("+asyncpg", "")
    for attempt in range(60):
        try:
            conn = await asyncpg.connect(dsn)
            await conn.close()
            print(f"[wait_for_db] Postgres disponível após {attempt + 1} tentativas")
            return 0
        except Exception as exc:  # noqa: BLE001
            print(f"[wait_for_db] tentativa {attempt + 1}: {exc.__class__.__name__}")
            await asyncio.sleep(1)
    print("[wait_for_db] timeout aguardando Postgres", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
