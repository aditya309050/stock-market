from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "NSE Screener Pro"
    API_V1_STR: str = "/api/v1"

    SECRET_KEY: str = "your-super-secret-key-for-jwt-auth"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/stock_trading_ai"

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    DHAN_CLIENT_ID: str = ""
    DHAN_ACCESS_TOKEN: str = ""
    DHAN_BASE_URL: str = "https://api.dhan.co/v2"
    DHAN_WS_URL: str = "wss://api-feed.dhan.co"
    DHAN_SCRIP_MASTER_URL: str = "https://images.dhan.co/api-data/api-scrip-master.csv"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    @property
    def openai_configured(self) -> bool:
        return bool(self.OPENAI_API_KEY)

    @property
    def dhan_configured(self) -> bool:
        return bool(self.DHAN_CLIENT_ID and self.DHAN_ACCESS_TOKEN)


settings = Settings()

