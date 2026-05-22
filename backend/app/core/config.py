from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "NSE Screener Pro"
    API_V1_STR: str = "/api/v1"

    SECRET_KEY: str = "your-super-secret-key-for-jwt-auth"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/stock_trading_ai"

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    @property
    def openai_configured(self) -> bool:
        return bool(self.OPENAI_API_KEY)


settings = Settings()
