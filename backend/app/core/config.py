import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///backend/app/db/hub_operations.db")
    AGGREGATION_FLOOR: int = int(os.getenv("AGGREGATION_FLOOR", "5"))
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")

settings = Settings()
