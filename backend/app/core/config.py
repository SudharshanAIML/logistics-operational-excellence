import os

class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///backend/app/db/hub_operations.db")
    AGGREGATION_FLOOR: int = int(os.getenv("AGGREGATION_FLOOR", "5"))
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

settings = Settings()
