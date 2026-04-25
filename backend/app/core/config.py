from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ===== App =====
    app_name: str = "contactpro-backend"
    app_port: int = Field(default=8000)
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # ===== AI provider switch =====
    ai_provider: Literal["openai", "anthropic"] = "openai"
    ai_model: str = "gpt-4o-mini"
    ai_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    # ===== STT =====
    stt_provider: Literal["openai"] = "openai"
    stt_model: str = "whisper-1"
    stt_api_key: str = ""

    # ===== TTS =====
    tts_provider: Literal["openai"] = "openai"
    tts_model: str = "gpt-4o-mini-tts"
    tts_voice: str = "alloy"
    tts_format: Literal["mp3", "opus", "aac", "flac", "wav", "pcm"] = "opus"
    tts_api_key: str = ""

    # ===== Vision =====
    vision_enabled: bool = True
    vision_model: str = "gpt-4o-mini"

    # ===== Database =====
    database_url: str = "postgresql+asyncpg://contactpro:contactpro@db:5432/contactpro"

    # ===== Redis =====
    redis_url: str = "redis://redis:6379"

    # ===== Evolution API =====
    evolution_api_url: str = "http://evolution:8080"
    evolution_api_key: str = ""
    evolution_instance: str = "contactpro"
    evolution_webhook_url: str = "http://backend:8000/api/webhooks/evolution"

    # ===== CORS / Socket.IO =====
    socket_cors_origins: str = "http://localhost:5173"

    # ===== Admin auth (rotas /api/whatsapp/*) =====
    # Token administrativo para proteger endpoints de gestão da instância WhatsApp.
    # Frontend envia via header `X-Admin-Token`. Vazio = endpoints desabilitados.
    admin_api_token: str = ""

    # ===== Whitelist de números (modo desenvolvimento) =====
    # Lista separada por vírgula de números (com ou sem código do país, sem `@s.whatsapp.net`).
    # Ex: "5511999999999,5521988887777". Vazio = sem filtro (responde todo mundo).
    # Útil em dev para o bot só responder ao seu próprio número durante testes.
    whatsapp_allowed_numbers: str = ""

    @property
    def whatsapp_allowed_numbers_list(self) -> list[str]:
        """Números normalizados (apenas dígitos)."""
        raw = [n.strip() for n in self.whatsapp_allowed_numbers.split(",") if n.strip()]
        return ["".join(c for c in n if c.isdigit()) for n in raw if any(c.isdigit() for c in n)]

    @property
    def socket_cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.socket_cors_origins.split(",") if o.strip()]

    @property
    def active_ai_api_key(self) -> str:
        if self.ai_provider == "openai":
            return self.openai_api_key or self.ai_api_key
        return self.anthropic_api_key or self.ai_api_key

    @property
    def active_stt_api_key(self) -> str:
        return self.stt_api_key or self.openai_api_key or self.ai_api_key

    @property
    def active_tts_api_key(self) -> str:
        return self.tts_api_key or self.openai_api_key or self.ai_api_key


@lru_cache
def get_settings() -> Settings:
    return Settings()
