"""
Modul-Endpunkte.

GET    /api/modules          — Alle Module mit Filtern
GET    /api/modules/info      — Semester/Stand-Info + Statistik
DELETE /api/modules/reset     — Datenbank leeren
GET    /api/modules/{nr}      — Einzelnes Modul
"""

import logging
from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.database import (
    get_db,
    DokumentDB,
    VeranstaltungDB,
    TerminDB,
    DozentenMappingDB,
    PlanEintragDB,
    ModulMetaDB,
)
from app.models.modulhandbuch_db import ModulhandbuchDB
from app.models.fpo_db import FpoPlanDB
from app.models.studienverlauf_db import StudienverlaufDB

logger = logging.getLogger(__name__)
router = APIRouter()


def _merge_termine(termine_raw: list[dict]) -> list[dict]:
    """
    Fasst Termine zusammen die gleiche Zeit + Raum + Dozent haben.

    Mehrere Zeilen fuer verschiedene Klassen (z.B. 2BID, 2BET, 2BET-P)
    werden zu einem Termin mit zusammengefassten Klassen.
    """
    merged: dict[str, dict] = {}

    for t in termine_raw:
        # Schluessel: Tag + Zeit + Raum + Dozent + Gruppe
        key = f"{t['tag']}|{t['start_zeit']}|{t['end_zeit']}|{t['raum'] or ''}|{t['dozent_kuerzel'] or ''}|{t['gruppe'] or ''}"

        if key not in merged:
            merged[key] = {
                **t,
                "klassen": list(t["klassen"]),
            }
        else:
            # Klassen zusammenfuehren (keine Duplikate)
            existing = merged[key]
            for kla in t["klassen"]:
                if kla not in existing["klassen"]:
                    existing["klassen"].append(kla)

    return list(merged.values())


@router.get("/info")
async def get_info(db: AsyncSession = Depends(get_db)):
    """Gibt Semester, Stand und Statistik der geladenen Daten zurueck."""
    # Letztes Dokument mit Semester-Info
    doc_query = await db.execute(
        select(DokumentDB)
        .where(DokumentDB.doc_type == "veranstaltungsliste")
        .order_by(DokumentDB.uploaded_at.desc())
        .limit(1)
    )
    doc = doc_query.scalar_one_or_none()

    # Zaehler
    veranst_count = await db.execute(select(func.count(VeranstaltungDB.id)))
    termin_count = await db.execute(select(func.count(TerminDB.id)))
    dozent_count = await db.execute(select(func.count(DozentenMappingDB.id)))

    # Modulhandbuch/FPO Zaehler
    mh_count = await db.execute(select(func.count(ModulhandbuchDB.id)))
    fpo_count = await db.execute(select(func.count(FpoPlanDB.id)))

    return {
        "semester": doc.semester if doc else None,
        "stand": doc.stand if doc else None,
        "statistik": {
            "veranstaltungen": veranst_count.scalar() or 0,
            "termine": termin_count.scalar() or 0,
            "dozenten_mappings": dozent_count.scalar() or 0,
            "modulhandbuch": mh_count.scalar() or 0,
            "fpo": fpo_count.scalar() or 0,
        },
    }


@router.delete("/reset")
async def reset_database(db: AsyncSession = Depends(get_db)):
    """Loescht alle extrahierten Daten aus der Datenbank."""
    await db.execute(delete(PlanEintragDB))
    await db.execute(delete(TerminDB))
    await db.execute(delete(VeranstaltungDB))
    await db.execute(delete(DozentenMappingDB))
    await db.execute(delete(ModulMetaDB))
    await db.execute(delete(ModulhandbuchDB))
    await db.execute(delete(FpoPlanDB))
    await db.execute(delete(StudienverlaufDB))
    await db.execute(delete(DokumentDB))
    await db.commit()
    return {"status": "reset", "message": "Alle Daten geloescht."}


@router.get("/reset-info")
async def reset_info(db: AsyncSession = Depends(get_db)):
    """Gibt eine Uebersicht was in der Datenbank existiert (fuer den Reset-Dialog)."""
    from sqlalchemy import distinct

    veranst_count = (await db.execute(select(func.count(VeranstaltungDB.id)))).scalar() or 0
    plan_count = (await db.execute(select(func.count(PlanEintragDB.id)))).scalar() or 0

    # Modulhandbuch pro Studiengang
    mh_rows = await db.execute(
        select(ModulhandbuchDB.studiengang, func.count(ModulhandbuchDB.id))
        .group_by(ModulhandbuchDB.studiengang)
        .order_by(ModulhandbuchDB.studiengang)
    )
    mh_studiengaenge = [
        {"studiengang": row[0] or "Unbekannt", "anzahl": row[1]}
        for row in mh_rows.all()
    ]

    # FPO pro Studiengang
    fpo_rows = await db.execute(
        select(FpoPlanDB.studiengang, func.count(FpoPlanDB.id))
        .group_by(FpoPlanDB.studiengang)
        .order_by(FpoPlanDB.studiengang)
    )
    fpo_studiengaenge = [
        {"studiengang": row[0] or "Unbekannt", "anzahl": row[1]}
        for row in fpo_rows.all()
    ]

    # Studienverlauf-Pläne
    sv_rows = await db.execute(
        select(StudienverlaufDB.plan_name, func.count(StudienverlaufDB.id))
        .group_by(StudienverlaufDB.plan_name)
        .order_by(StudienverlaufDB.plan_name)
    )
    studienverlauf_plaene = [
        {"plan_name": row[0], "anzahl": row[1]}
        for row in sv_rows.all()
    ]

    return {
        "veranstaltungen": veranst_count,
        "wochenplan": plan_count,
        "modulhandbuch": mh_studiengaenge,
        "fpo": fpo_studiengaenge,
        "studienverlauf": studienverlauf_plaene,
    }


class SelectiveResetRequest:
    pass


@router.post("/reset-selective")
async def reset_selective(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Loescht gezielt ausgewaehlte Datenkategorien."""
    deleted = []

    if body.get("veranstaltungen"):
        await db.execute(delete(PlanEintragDB))
        await db.execute(delete(TerminDB))
        await db.execute(delete(VeranstaltungDB))
        await db.execute(delete(DozentenMappingDB))
        await db.execute(delete(ModulMetaDB))
        await db.execute(delete(DokumentDB).where(DokumentDB.doc_type == "veranstaltungsliste"))
        deleted.append("Veranstaltungen")

    if body.get("wochenplan"):
        await db.execute(delete(PlanEintragDB))
        await db.execute(delete(DokumentDB).where(DokumentDB.doc_type == "wochenplan_htm"))
        deleted.append("Wochenplan")

    for sg in body.get("modulhandbuch_studiengaenge", []):
        await db.execute(delete(ModulhandbuchDB).where(ModulhandbuchDB.studiengang == sg))
        deleted.append(f"Modulhandbuch:{sg}")

    for sg in body.get("fpo_studiengaenge", []):
        await db.execute(delete(FpoPlanDB).where(FpoPlanDB.studiengang == sg))
        deleted.append(f"FPO:{sg}")

    for plan in body.get("studienverlauf_plaene", []):
        await db.execute(delete(StudienverlaufDB).where(StudienverlaufDB.plan_name == plan))
        deleted.append(f"Studienverlauf:{plan}")

    await db.commit()
    return {"status": "ok", "deleted": deleted}


@router.get("/")
async def list_modules(
    studiengang: str | None = Query(None, description="Filter nach Studiengang (z.B. BID, BET)"),
    semester: int | None = Query(None, description="Filter nach Semester (2, 4, 6)"),
    suche: str | None = Query(None, description="Freitext-Suche in Name, Dozent, Raum"),
    db: AsyncSession = Depends(get_db),
):
    """Listet alle extrahierten Module, gruppiert nach Modulnummer."""

    query = select(VeranstaltungDB).options(selectinload(VeranstaltungDB.termine))
    result = await db.execute(query)
    alle_veranstaltungen = result.scalars().all()

    dozenten_query = await db.execute(select(DozentenMappingDB))
    dozenten_map = {d.kuerzel: d.name for d in dozenten_query.scalars().all()}

    # Semester-Info laden
    doc_query = await db.execute(
        select(DokumentDB)
        .where(DokumentDB.doc_type == "veranstaltungsliste")
        .order_by(DokumentDB.uploaded_at.desc())
        .limit(1)
    )
    doc = doc_query.scalar_one_or_none()

    module_dict: dict[str, list] = defaultdict(list)
    for v in alle_veranstaltungen:
        module_dict[v.modul_nummer].append(v)

    module_list = []
    for modul_nummer, veranstaltungen in module_dict.items():
        alle_klassen = set()
        alle_dozenten = set()
        alle_raeume = set()
        for v in veranstaltungen:
            for t in v.termine:
                if t.klassen:
                    alle_klassen.update(t.klassen)
                if t.dozent_kuerzel:
                    alle_dozenten.add(t.dozent_kuerzel)
                if t.raum:
                    alle_raeume.add(t.raum)

        if studiengang:
            if not any(studiengang.upper() in k for k in alle_klassen):
                continue

        if semester is not None:
            semester_match = any(
                k.startswith(str(semester)) or k.startswith(f"S{semester}")
                for k in alle_klassen
            )
            if not semester_match:
                continue

        if suche:
            suche_lower = suche.lower()
            name_match = any(suche_lower in v.name.lower() for v in veranstaltungen)
            dozent_match = any(suche_lower in d.lower() for d in alle_dozenten)
            raum_match = any(suche_lower in r.lower() for r in alle_raeume)
            if not (name_match or dozent_match or raum_match):
                continue

        modul_name = veranstaltungen[0].name

        # Veranstaltungen gleichen Typs zusammenfuehren
        # (das PDF hat z.B. "90099110 V" auf mehreren Seiten als separate Bloecke)
        typ_termine: dict[str, list[dict]] = defaultdict(list)
        typ_name: dict[str, str] = {}
        for v in veranstaltungen:
            if v.typ not in typ_name:
                typ_name[v.typ] = v.name
            for t in v.termine:
                dozent_name = dozenten_map.get(t.dozent_kuerzel, None) if t.dozent_kuerzel else None
                typ_termine[v.typ].append({
                    "tag": t.tag,
                    "start_zeit": t.start_zeit,
                    "end_zeit": t.end_zeit,
                    "raum": t.raum,
                    "dozent_kuerzel": t.dozent_kuerzel,
                    "dozent_name": dozent_name,
                    "klassen": t.klassen or [],
                    "gruppe": t.gruppe,
                    "bemerkung": t.bemerkung,
                })

        veranst_daten = []
        for typ, termine_raw in typ_termine.items():
            merged = _merge_termine(termine_raw)
            veranst_daten.append({
                "typ": typ,
                "name": typ_name[typ],
                "termine": merged,
            })

        module_list.append({
            "modul_nummer": modul_nummer,
            "name": modul_name,
            "veranstaltungen": veranst_daten,
            "studiengaenge": sorted(alle_klassen),
            "dozenten": {k: dozenten_map.get(k, k) for k in sorted(alle_dozenten)},
            "raeume": sorted(alle_raeume),
        })

    module_list.sort(key=lambda m: m["modul_nummer"])

    return {
        "module": module_list,
        "total": len(module_list),
        "semester": doc.semester if doc else None,
        "stand": doc.stand if doc else None,
    }


@router.get("/{modul_nummer}")
async def get_module(modul_nummer: str, db: AsyncSession = Depends(get_db)):
    """Gibt ein einzelnes Modul mit allen Details zurueck."""
    query = (
        select(VeranstaltungDB)
        .where(VeranstaltungDB.modul_nummer == modul_nummer)
        .options(selectinload(VeranstaltungDB.termine))
    )
    result = await db.execute(query)
    veranstaltungen = result.scalars().all()

    if not veranstaltungen:
        return {"error": f"Modul {modul_nummer} nicht gefunden."}

    dozenten_query = await db.execute(select(DozentenMappingDB))
    dozenten_map = {d.kuerzel: d.name for d in dozenten_query.scalars().all()}

    # Gleiche Typen zusammenfuehren (PDF hat oft mehrere Bloecke pro Typ)
    typ_termine: dict[str, list[dict]] = defaultdict(list)
    typ_name: dict[str, str] = {}
    for v in veranstaltungen:
        if v.typ not in typ_name:
            typ_name[v.typ] = v.name
        for t in v.termine:
            dozent_name = dozenten_map.get(t.dozent_kuerzel) if t.dozent_kuerzel else None
            typ_termine[v.typ].append({
                "tag": t.tag,
                "start_zeit": t.start_zeit,
                "end_zeit": t.end_zeit,
                "raum": t.raum,
                "dozent_kuerzel": t.dozent_kuerzel,
                "dozent_name": dozent_name,
                "klassen": t.klassen or [],
                "gruppe": t.gruppe,
                "bemerkung": t.bemerkung,
            })

    veranst_daten = []
    for typ, termine_raw in typ_termine.items():
        veranst_daten.append({
            "typ": typ,
            "name": typ_name[typ],
            "termine": _merge_termine(termine_raw),
        })

    return {
        "modul_nummer": modul_nummer,
        "name": veranstaltungen[0].name,
        "veranstaltungen": veranst_daten,
    }
