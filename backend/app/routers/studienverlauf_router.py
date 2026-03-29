"""
Studienverlauf-Endpunkte.

GET    /api/studienverlauf              — Alle Plaene laden
POST   /api/studienverlauf/modul        — Modul hinzufuegen
PUT    /api/studienverlauf/modul/{id}   — Modul bearbeiten
DELETE /api/studienverlauf/modul/{id}   — Modul entfernen
POST   /api/studienverlauf/semester     — Semester-Anzahl aendern
DELETE /api/studienverlauf/{plan}       — Plan loeschen
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db
from app.models.studienverlauf_db import StudienverlaufDB

router = APIRouter()


class ModulCreate(BaseModel):
    plan_name: str
    name: str
    semester: int


class ModulUpdate(BaseModel):
    name: str | None = None
    semester: int | None = None


class SemesterUpdate(BaseModel):
    plan_name: str
    anzahl_semester: int


@router.get("/")
async def get_studienverlauf(db: AsyncSession = Depends(get_db)):
    """Gibt alle Studienverlaufsplaene zurueck."""
    result = await db.execute(
        select(StudienverlaufDB).order_by(StudienverlaufDB.plan_name, StudienverlaufDB.semester, StudienverlaufDB.id)
    )
    alle = result.scalars().all()

    plaene: dict[str, dict] = {}
    for m in alle:
        if m.plan_name not in plaene:
            plaene[m.plan_name] = {
                "plan_name": m.plan_name,
                "studiengang": m.studiengang,
                "anzahl_semester": m.anzahl_semester,
                "module": [],
            }
        if m.anzahl_semester > plaene[m.plan_name]["anzahl_semester"]:
            plaene[m.plan_name]["anzahl_semester"] = m.anzahl_semester

        plaene[m.plan_name]["module"].append({
            "id": m.id,
            "name": m.name,
            "semester": m.semester,
            "hat_pvl": m.hat_pvl,
        })

    return {"plaene": list(plaene.values())}


@router.post("/modul")
async def add_modul(entry: ModulCreate, db: AsyncSession = Depends(get_db)):
    """Fuegt ein Modul zum Studienverlaufsplan hinzu."""
    db_entry = StudienverlaufDB(
        plan_name=entry.plan_name,
        name=entry.name,
        semester=entry.semester,
        anzahl_semester=entry.semester,
    )
    db.add(db_entry)
    await db.commit()
    await db.refresh(db_entry)
    return {"id": db_entry.id, "name": db_entry.name, "semester": db_entry.semester}


@router.put("/modul/{modul_id}")
async def update_modul(modul_id: int, update: ModulUpdate, db: AsyncSession = Depends(get_db)):
    """Aktualisiert ein Modul (Name oder Semester verschieben)."""
    result = await db.execute(select(StudienverlaufDB).where(StudienverlaufDB.id == modul_id))
    modul = result.scalar_one_or_none()
    if not modul:
        raise HTTPException(status_code=404, detail="Modul nicht gefunden")

    if update.name is not None:
        modul.name = update.name
    if update.semester is not None:
        modul.semester = update.semester

    await db.commit()
    return {"id": modul.id, "name": modul.name, "semester": modul.semester}


@router.delete("/modul/{modul_id}")
async def delete_modul(modul_id: int, db: AsyncSession = Depends(get_db)):
    """Entfernt ein Modul aus dem Studienverlaufsplan."""
    result = await db.execute(select(StudienverlaufDB).where(StudienverlaufDB.id == modul_id))
    modul = result.scalar_one_or_none()
    if not modul:
        raise HTTPException(status_code=404, detail="Modul nicht gefunden")

    await db.delete(modul)
    await db.commit()
    return {"status": "deleted"}


@router.post("/semester")
async def update_semester_count(update: SemesterUpdate, db: AsyncSession = Depends(get_db)):
    """Aendert die Semester-Anzahl fuer einen Plan."""
    result = await db.execute(
        select(StudienverlaufDB).where(StudienverlaufDB.plan_name == update.plan_name)
    )
    module = result.scalars().all()
    for m in module:
        m.anzahl_semester = update.anzahl_semester
    await db.commit()
    return {"plan_name": update.plan_name, "anzahl_semester": update.anzahl_semester}


@router.delete("/{plan_name}")
async def delete_plan(plan_name: str, db: AsyncSession = Depends(get_db)):
    """Loescht einen ganzen Studienverlaufsplan."""
    await db.execute(delete(StudienverlaufDB).where(StudienverlaufDB.plan_name == plan_name))
    await db.commit()
    return {"status": "deleted", "plan_name": plan_name}
