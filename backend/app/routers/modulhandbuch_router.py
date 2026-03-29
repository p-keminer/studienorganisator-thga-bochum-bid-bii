"""
Modulhandbuch-Endpunkte.

GET /api/modulhandbuch             — Alle Module (optional nach Studiengang gefiltert)
GET /api/modulhandbuch/studiengaenge — Liste aller vorhandenen Studiengaenge
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db
from app.models.modulhandbuch_db import ModulhandbuchDB

router = APIRouter()


@router.get("/studiengaenge")
async def list_studiengaenge(db: AsyncSession = Depends(get_db)):
    """Gibt alle vorhandenen Studiengaenge zurueck."""
    result = await db.execute(
        select(distinct(ModulhandbuchDB.studiengang))
        .where(ModulhandbuchDB.studiengang.is_not(None))
        .order_by(ModulhandbuchDB.studiengang)
    )
    return {"studiengaenge": [row[0] for row in result.all()]}


@router.get("/")
async def list_modulhandbuch(
    studiengang: str | None = Query(None, description="Filter nach Studiengang"),
    db: AsyncSession = Depends(get_db),
):
    """Gibt alle Module aus dem Modulhandbuch zurueck."""
    query = select(ModulhandbuchDB).order_by(ModulhandbuchDB.name)
    if studiengang:
        query = query.where(ModulhandbuchDB.studiengang == studiengang)

    result = await db.execute(query)
    module = result.scalars().all()

    return {
        "module": [
            {
                "id": m.id,
                "studiengang": m.studiengang,
                "name": m.name,
                "kuerzel": m.kuerzel,
                "niveau": m.niveau,
                "studiensemester": m.studiensemester,
                "modulverantwortlicher": m.modulverantwortlicher,
                "sprache": m.sprache,
                "zuordnung": m.zuordnung,
                "sws": {
                    "vorlesung": m.sws_vorlesung,
                    "uebung": m.sws_uebung,
                    "praktikum": m.sws_praktikum,
                    "seminar": m.sws_seminar,
                    "su": m.sws_su,
                },
                "arbeitsaufwand": m.arbeitsaufwand,
                "credit_points": m.credit_points,
                "pvl": m.pvl,
                "empfohlene_voraussetzungen": m.empfohlene_voraussetzungen,
                "lernziele": m.lernziele,
                "inhalt": m.inhalt,
                "pruefungsformen": m.pruefungsformen,
            }
            for m in module
        ],
        "total": len(module),
    }
