from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "NSE Screener Pro"
    API_V1_STR: str = "/api/v1"

    SECRET_KEY: str = "your-super-secret-key-for-jwt-auth"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/stock_trading_ai"

    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000,http://127.0.0.1:8000"

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    DHAN_CLIENT_ID: str = ""
    DHAN_API_KEY: str = ""
    DHAN_API_SECRET: str = ""
    DHAN_ACCESS_TOKEN: str = ""
    DHAN_BASE_URL: str = "https://api.dhan.co/v2"
    DHAN_WS_URL: str = "wss://api-feed.dhan.co"
    DHAN_SCRIP_MASTER_URL: str = "https://images.dhan.co/api-data/api-scrip-master.csv"

    # Telegram Alert Bot Configuration
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""
    ALERTS_ENABLED: bool = True

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    @property
    def cors_origins(self) -> list[str]:
        if not self.ALLOWED_ORIGINS:
            return ["http://localhost:3000", "http://localhost:8000"]
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def openai_configured(self) -> bool:
        return bool(self.OPENAI_API_KEY)

    @property
    def dhan_configured(self) -> bool:
        return bool(self.DHAN_CLIENT_ID and self.DHAN_ACCESS_TOKEN)

    @property
    def telegram_configured(self) -> bool:
        return bool(self.TELEGRAM_BOT_TOKEN and self.TELEGRAM_CHAT_ID)


settings = Settings()

