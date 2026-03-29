"""
FastAPI Entry Point fuer den Studienorganisator.

Startet den API-Server mit allen Routern.
Bindet standardmaessig nur an localhost (127.0.0.1) — nicht an 0.0.0.0.

Heartbeat: Das Frontend pingt /api/heartbeat alle 5 Sekunden.
Wenn 15 Sekunden kein Ping kommt (Tab geschlossen), faehrt sich
das Backend automatisch herunter.
"""

import asyncio
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.models.database import init_db
from app.routers import pdf_router, module_router, schedule_router, modulhandbuch_router, fpo_router, studienverlauf_router
import app.models.modulhandbuch_db  # noqa: F401
import app.models.fpo_db  # noqa: F401
import app.models.studienverlauf_db  # noqa: F401

# Letzter Heartbeat-Zeitpunkt (Sekunden seit Epoch)
_last_heartbeat: float = time.time()
HEARTBEAT_TIMEOUT = 45  # Sekunden ohne Ping -> Shutdown


async def _heartbeat_watchdog():
    """Hintergrund-Task: Prueft ob das Frontend noch lebt."""
    global _last_heartbeat
    while True:
        await asyncio.sleep(5)
        elapsed = time.time() - _last_heartbeat
        if elapsed > HEARTBEAT_TIMEOUT:
            print("\n[Studienorganisator] Browser-Tab geschlossen — beende Backend...")
            # Gesamten Prozessbaum beenden (inkl. uvicorn --reload Parent)
            import signal
            try:
                os.kill(os.getppid(), signal.SIGTERM)
            except (ProcessLookupError, PermissionError):
                pass
            os._exit(0)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """App-Lifecycle: DB initialisieren, Watchdog starten."""
    await init_db()
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)

    # Heartbeat-Watchdog starten
    watchdog_task = asyncio.create_task(_heartbeat_watchdog())

    yield

    watchdog_task.cancel()


app = FastAPI(
    title="Studienorganisator API",
    description="Backend fuer den Studienorganisator — extrahiert Studiendaten aus PDFs",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug_mode else None,
    redoc_url="/redoc" if settings.debug_mode else None,
)

# CORS — nur erlaubte Origins (Tauri Webview + Vite Dev-Server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Bei JEDEM Request den Heartbeat-Timer resetten
# (PDF-Upload dauert lange, waehrenddessen kommen keine Heartbeats)
@app.middleware("http")
async def reset_heartbeat_on_request(request, call_next):
    global _last_heartbeat
    _last_heartbeat = time.time()
    response = await call_next(request)
    _last_heartbeat = time.time()
    return response


# Router einbinden
app.include_router(pdf_router.router, prefix="/api/pdf", tags=["PDF"])
app.include_router(module_router.router, prefix="/api/modules", tags=["Module"])
app.include_router(schedule_router.router, prefix="/api/schedule", tags=["Stundenplan"])
app.include_router(modulhandbuch_router.router, prefix="/api/modulhandbuch", tags=["Modulhandbuch"])
app.include_router(fpo_router.router, prefix="/api/fpo", tags=["FPO"])
app.include_router(studienverlauf_router.router, prefix="/api/studienverlauf", tags=["Studienverlauf"])


@app.get("/api/health")
async def health_check():
    """Einfacher Health-Check."""
    return {"status": "ok", "version": "0.1.0"}


@app.post("/api/heartbeat")
async def heartbeat():
    """Vom Frontend alle 5 Sek aufgerufen. Haelt das Backend am Leben."""
    global _last_heartbeat
    _last_heartbeat = time.time()
    return {"status": "alive"}
