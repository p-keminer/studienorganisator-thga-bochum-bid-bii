"""
Wochenplan-Endpunkte (CRUD fuer persoenliche Plan-Eintraege).

GET    /api/schedule         — Alle Eintraege laden
POST   /api/schedule         — Neuen Eintrag erstellen
DELETE /api/schedule/{id}    — Eintrag entfernen
DELETE /api/schedule         — Alle Eintraege loeschen
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db, PlanEintragDB

router = APIRouter()


class PlanEintragCreate(BaseModel):
    """Request-Body fuer neuen Wochenplan-Eintrag."""

    modul_nummer: str
    veranstaltungs_typ: str
    display_name: str
    tag: str
    start_zeit: str
    end_zeit: str
    slot: int
    raum: str | None = None
    dozent: str | None = None
    gruppe: str | None = None
    farbe: str = "#3b82f6"
    notizen: str | None = None


class PlanEintragResponse(BaseModel):
    """Response fuer einen Wochenplan-Eintrag."""

    id: int
    modul_nummer: str
    veranstaltungs_typ: str
    display_name: str
    tag: str
    start_zeit: str
    end_zeit: str
    slot: int
    raum: str | None
    dozent: str | None
    gruppe: str | None
    farbe: str
    notizen: str | None


@router.get("/")
async def get_schedule(db: AsyncSession = Depends(get_db)):
    """Laedt alle Wochenplan-Eintraege."""
    result = await db.execute(select(PlanEintragDB))
    eintraege = result.scalars().all()

    return {
        "eintraege": [
            {
                "id": e.id,
                "modul_nummer": e.modul_nummer,
                "veranstaltungs_typ": e.veranstaltungs_typ,
                "display_name": e.display_name,
                "tag": e.tag,
                "start_zeit": e.start_zeit,
                "end_zeit": e.end_zeit,
                "slot": e.slot or 0,
                "raum": e.raum,
                "dozent": e.dozent,
                "gruppe": e.gruppe,
                "farbe": e.farbe or "#3b82f6",
                "notizen": e.notizen,
            }
            for e in eintraege
        ]
    }


@router.post("/")
async def create_entry(
    entry: PlanEintragCreate,
    db: AsyncSession = Depends(get_db),
):
    """Erstellt einen neuen Wochenplan-Eintrag."""
    db_entry = PlanEintragDB(
        modul_nummer=entry.modul_nummer,
        veranstaltungs_typ=entry.veranstaltungs_typ,
        display_name=entry.display_name,
        tag=entry.tag,
        start_zeit=entry.start_zeit,
        end_zeit=entry.end_zeit,
        slot=entry.slot,
        raum=entry.raum,
        dozent=entry.dozent,
        gruppe=entry.gruppe,
        farbe=entry.farbe,
        notizen=entry.notizen,
    )
    db.add(db_entry)
    await db.commit()
    await db.refresh(db_entry)

    return {
        "id": db_entry.id,
        "modul_nummer": db_entry.modul_nummer,
        "veranstaltungs_typ": db_entry.veranstaltungs_typ,
        "display_name": db_entry.display_name,
        "tag": db_entry.tag,
        "start_zeit": db_entry.start_zeit,
        "end_zeit": db_entry.end_zeit,
        "slot": entry.slot,
        "raum": db_entry.raum,
        "dozent": db_entry.dozent,
        "farbe": db_entry.farbe,
        "notizen": db_entry.notizen,
    }


@router.delete("/{entry_id}")
async def delete_entry(entry_id: int, db: AsyncSession = Depends(get_db)):
    """Entfernt einen Eintrag aus dem Wochenplan."""
    result = await db.execute(
        select(PlanEintragDB).where(PlanEintragDB.id == entry_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Eintrag nicht gefunden.")

    await db.delete(entry)
    await db.commit()
    return {"status": "deleted", "id": entry_id}


@router.delete("/")
async def clear_schedule(db: AsyncSession = Depends(get_db)):
    """Loescht alle Wochenplan-Eintraege."""
    await db.execute(delete(PlanEintragDB))
    await db.commit()
    return {"status": "cleared"}
