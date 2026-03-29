"""
FPO-Endpunkte.

GET /api/fpo                — Alle FPO-Pruefungsplaene (optional nach Studiengang gefiltert)
GET /api/fpo/studiengaenge  — Liste aller vorhandenen Studiengaenge
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db
from app.models.fpo_db import FpoPlanDB

router = APIRouter()


@router.get("/studiengaenge")
async def list_studiengaenge(db: AsyncSession = Depends(get_db)):
    """Gibt alle vorhandenen Studiengaenge zurueck."""
    result = await db.execute(
        select(distinct(FpoPlanDB.studiengang))
        .where(FpoPlanDB.studiengang.is_not(None))
        .order_by(FpoPlanDB.studiengang)
    )
    return {"studiengaenge": [row[0] for row in result.all()]}


@router.get("/")
async def get_fpo(
    studiengang: str | None = Query(None, description="Filter nach Studiengang"),
    db: AsyncSession = Depends(get_db),
):
    """Gibt alle FPO-Pruefungsplaene zurueck, gruppiert nach Variante."""
    query = select(FpoPlanDB).order_by(FpoPlanDB.variante, FpoPlanDB.id)
    if studiengang:
        query = query.where(FpoPlanDB.studiengang == studiengang)

    result = await db.execute(query)
    alle = result.scalars().all()

    # Nach Variante gruppieren
    plaene: dict[str, dict] = {}
    for m in alle:
        if m.variante not in plaene:
            plaene[m.variante] = {"pflichtmodule": [], "wahlpflichtmodule": []}

        entry = {
            "pruefungsnummer": m.pruefungsnummer,
            "name": m.name,
            "cp": m.cp,
            "pvl": m.pvl,
            "pruefungsereignis": m.pruefungsereignis,
            "pruefungsform": m.pruefungsform,
            "semester": m.semester,
            "kategorie": m.kategorie,
        }

        if m.ist_wahlpflicht:
            plaene[m.variante]["wahlpflichtmodule"].append(entry)
        else:
            plaene[m.variante]["pflichtmodule"].append(entry)

    return {
        "plaene": [
            {
                "variante": variante,
                "pflichtmodule": data["pflichtmodule"],
                "wahlpflichtmodule": data["wahlpflichtmodule"],
            }
            for variante, data in plaene.items()
        ],
        "total_varianten": len(plaene),
    }
