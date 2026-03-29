"""
Zentrale Konfiguration des Backends.

Alle Werte werden aus Umgebungsvariablen geladen.
Kein einziger hartcodierter Wert fuer Pfade, Ports oder Secrets.
"""

import os
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Anwendungs-Konfiguration aus Umgebungsvariablen."""

    # --- Datenbank ---
    database_url: str = "sqlite+aiosqlite:///data/studienorganisator.db"

    # --- API-Server ---
    api_host: str = "127.0.0.1"
    api_port: int = 8321
    debug_mode: bool = False

    # --- PDF-Verarbeitung ---
    max_upload_size_mb: int = 50
    default_parser_profile: str = "thga"
    upload_dir: str = "uploads"

    # --- CORS ---
    cors_allowed_origins: list[str] = [
        "tauri://localhost",
        "http://localhost:1420",
        "http://127.0.0.1:1420",
    ]

    # --- Logging ---
    log_level: str = "INFO"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }

    @property
    def upload_path(self) -> Path:
        """Absoluter Pfad zum Upload-Verzeichnis."""
        return Path(self.upload_dir).resolve()

    @property
    def max_upload_bytes(self) -> int:
        """Maximale Upload-Groesse in Bytes."""
        return self.max_upload_size_mb * 1024 * 1024


# Singleton — einmal laden, ueberall nutzen
settings = Settings()
