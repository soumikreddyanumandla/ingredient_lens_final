from __future__ import annotations
import os
from dataclasses import dataclass

@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Ingredient Lens API")
    frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    request_timeout: float = float(os.getenv("REQUEST_TIMEOUT", "20"))
    llm_api_url: str = os.getenv("LLM_API_URL", "")
    llm_api_key: str = os.getenv("LLM_API_KEY", "")
    llm_model: str = os.getenv("LLM_MODEL", "gpt-4.1-mini")
    pubchem_email: str = os.getenv("PUBCHEM_EMAIL", "")

settings = Settings()
