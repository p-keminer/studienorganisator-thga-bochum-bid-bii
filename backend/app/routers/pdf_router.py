"""
PDF-Upload und Extraktions-Endpunkt.

POST /api/pdf/upload — Nimmt eine PDF/HTM-Datei entgegen,
validiert, extrahiert Daten und speichert in DB.
"""

import re
import logging
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.database import (
    get_db,
    DokumentDB,
    VeranstaltungDB,
    TerminDB,
    DozentenMappingDB,
    PlanEintragDB,
)
from app.services.veranstaltungsliste_parser import (
    parse_veranstaltungsliste,
    gruppiere_nach_modul,
)
from app.services.htm_parser import parse_wochenplan_htm
from app.services.modulhandbuch_parser import parse_modulhandbuch
from app.services.fpo_parser import parse_fpo
from app.services.studienverlauf_parser import parse_studienverlauf
from app.models.modulhandbuch_db import ModulhandbuchDB
from app.models.fpo_db import FpoPlanDB
from app.models.studienverlauf_db import StudienverlaufDB

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".htm", ".html"}
PDF_MAGIC_BYTES = b"%PDF"


def _detect_pdf_type(filename: str, path: Path) -> str:
    """
    Erkennt ob ein PDF ein Modulhandbuch oder eine Veranstaltungsliste ist.

    Strategie:
    1. Dateiname pruefen (schnell, zuverlaessig wenn User Datei nicht umbenennt)
    2. Erste Seite mit pdfplumber lesen (langsamer, aber robust)
    """
    name_lower = filename.lower()

    # Dateiname-Heuristik
    if "modulhandbuch" in name_lower or "modul_handbuch" in name_lower:
        return "modulhandbuch"
    if "veranstaltung" in name_lower or "studienplan" in name_lower:
        return "veranstaltungsliste"
    if "fpo" in name_lower or "fachpr" in name_lower or "pruefungsordnung" in name_lower:
        return "fpo"
    if "studienverlauf" in name_lower or "verlaufsplan" in name_lower:
        return "studienverlauf"

    # Inhalt der ersten Seite pruefen
    try:
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            if pdf.pages:
                first_page = pdf.pages[0].extract_text() or ""
                text_lower = first_page.lower()
                if "modulhandbuch" in text_lower or "modulbeschreibung" in text_lower:
                    return "modulhandbuch"
                if "fachprüfungsordnung" in text_lower or "prüfungsordnung" in text_lower:
                    return "fpo"
                # Studienverlauf: grafischer Plan mit Semester-Spalten
                if "semester" in text_lower and ("bachelor" in text_lower) and ("vollzeit" in text_lower or "praxisbegleitend" in text_lower):
                    # Kein "Prüfungsplan" oder "Modulhandbuch" -> wahrscheinlich Studienverlauf
                    if "prüfungsplan" not in text_lower and "modulhandbuch" not in text_lower:
                        return "studienverlauf"
                if "untis" in text_lower or "veranstaltung" in text_lower or "studienplan" in text_lower:
                    return "veranstaltungsliste"
    except Exception:
        pass

    # Default: Veranstaltungsliste
    return "veranstaltungsliste"


@router.post("/detect")
async def detect_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Analysiert eine Datei und gibt doc_type + studiengang zurueck, ohne in die DB zu schreiben.
    Prueft ausserdem ob der erkannte Studiengang bereits in der DB existiert.
    """
    if file.filename is None:
        raise HTTPException(status_code=400, detail="Kein Dateiname angegeben.")

    safe_filename = re.sub(r"[^\w\-.]", "_", file.filename)
    extension = Path(safe_filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Dateityp '{extension}' nicht erlaubt.")

    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="Datei zu gross.")

    if extension == ".pdf" and not content[:4].startswith(PDF_MAGIC_BYTES):
        raise HTTPException(status_code=400, detail="Datei ist kein gueltiges PDF.")

    # Temporaer speichern (wird nach Analyse geloescht)
    tmp_path = settings.upload_path / f"_detect_{safe_filename}"
    tmp_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path.write_bytes(content)

    try:
        if extension != ".pdf":
            return {"doc_type": "wochenplan_htm", "studiengang": None, "already_exists": False}

        pdf_type = _detect_pdf_type(safe_filename, tmp_path)
        studiengang = None
        already_exists = False

        if pdf_type == "modulhandbuch":
            try:
                resultat = parse_modulhandbuch(tmp_path)
                studiengang = resultat.studiengang
                if studiengang:
                    from sqlalchemy import distinct
                    result = await db.execute(
                        select(ModulhandbuchDB.id).where(
                            ModulhandbuchDB.studiengang == studiengang
                        ).limit(1)
                    )
                    already_exists = result.scalar_one_or_none() is not None
            except Exception:
                pass

        elif pdf_type == "fpo":
            try:
                resultat = parse_fpo(tmp_path)
                studiengang = resultat.studiengang
                if studiengang:
                    result = await db.execute(
                        select(FpoPlanDB.id).where(
                            FpoPlanDB.studiengang == studiengang
                        ).limit(1)
                    )
                    already_exists = result.scalar_one_or_none() is not None
            except Exception:
                pass

        return {
            "doc_type": pdf_type,
            "studiengang": studiengang,
            "already_exists": already_exists,
        }
    finally:
        try:
            tmp_path.unlink()
        except Exception:
            pass


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Laedt ein Dokument hoch, extrahiert Daten und speichert in DB.

    Akzeptiert: PDF (Veranstaltungsliste, FPO, Modulhandbuch), HTM (Wochenplaene)
    """
    if file.filename is None:
        raise HTTPException(status_code=400, detail="Kein Dateiname angegeben.")

    safe_filename = re.sub(r"[^\w\-.]", "_", file.filename)
    extension = Path(safe_filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Dateityp '{extension}' nicht erlaubt. Erlaubt: {ALLOWED_EXTENSIONS}",
        )

    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Datei zu gross. Maximum: {settings.max_upload_size_mb} MB",
        )

    if extension == ".pdf" and not content[:4].startswith(PDF_MAGIC_BYTES):
        raise HTTPException(
            status_code=400,
            detail="Datei ist kein gueltiges PDF.",
        )

    # Datei speichern
    upload_path = settings.upload_path / safe_filename
    upload_path.parent.mkdir(parents=True, exist_ok=True)
    upload_path.write_bytes(content)

    # Dokument-Typ erkennen und extrahieren
    if extension == ".pdf":
        pdf_type = _detect_pdf_type(safe_filename, upload_path)
        if pdf_type == "modulhandbuch":
            return await _process_modulhandbuch(safe_filename, upload_path, db)
        elif pdf_type == "fpo":
            return await _process_fpo(safe_filename, upload_path, db)
        elif pdf_type == "studienverlauf":
            return await _process_studienverlauf(safe_filename, upload_path, db)
        else:
            return await _process_pdf(safe_filename, upload_path, db)
    else:
        return await _process_htm(safe_filename, upload_path, db)


async def _process_studienverlauf(
    filename: str, path: Path, db: AsyncSession
) -> dict:
    """Verarbeitet einen Studienverlaufsplan (grafisches PDF)."""
    try:
        resultat = parse_studienverlauf(path)
    except Exception as e:
        logger.error("Studienverlauf-Parsing fehlgeschlagen: %s", e)
        raise HTTPException(status_code=422, detail=f"Studienverlauf-Parsing fehlgeschlagen: {e}")

    plan_name = resultat.variante or filename.replace(".pdf", "").replace("_", " ")

    dokument = DokumentDB(dateiname=filename, doc_type="studienverlauf")
    db.add(dokument)

    # Alte Eintraege fuer diesen Plan loeschen
    from sqlalchemy import delete as sql_delete
    await db.execute(
        sql_delete(StudienverlaufDB).where(StudienverlaufDB.plan_name == plan_name)
    )

    for m in resultat.module:
        db.add(StudienverlaufDB(
            plan_name=plan_name,
            studiengang=resultat.studiengang,
            anzahl_semester=resultat.anzahl_semester,
            name=m.name,
            semester=m.semester,
            hat_pvl=m.hat_pvl,
        ))

    await db.commit()

    return {
        "status": "success",
        "filename": filename,
        "doc_type": "studienverlauf",
        "plan_name": plan_name,
        "statistik": {
            "module": len(resultat.module),
            "semester": resultat.anzahl_semester,
        },
    }


async def _process_fpo(
    filename: str, path: Path, db: AsyncSession
) -> dict:
    """Verarbeitet eine Fachpruefungsordnung (PDF)."""
    try:
        resultat = parse_fpo(path)
    except Exception as e:
        logger.error("FPO-Parsing fehlgeschlagen: %s", e)
        raise HTTPException(status_code=422, detail=f"FPO-Parsing fehlgeschlagen: {e}")

    dokument = DokumentDB(dateiname=filename, doc_type="fpo")
    db.add(dokument)

    # Alte FPO-Eintraege fuer diesen Studiengang loeschen
    from sqlalchemy import delete
    studiengang = resultat.studiengang or "Unbekannt"
    await db.execute(
        delete(FpoPlanDB).where(FpoPlanDB.studiengang == studiengang)
    )

    total = 0
    for plan in resultat.plaene:
        for m in plan.pflichtmodule + plan.wahlpflichtmodule:
            db.add(FpoPlanDB(
                studiengang=studiengang,
                variante=plan.variante,
                pruefungsnummer=m.pruefungsnummer,
                name=m.name,
                cp=m.cp,
                pvl=m.pvl,
                pruefungsereignis=m.pruefungsereignis,
                pruefungsform=m.pruefungsform,
                semester=m.semester,
                ist_wahlpflicht=m.ist_wahlpflicht,
                kategorie=m.kategorie,
            ))
            total += 1

    await db.commit()

    return {
        "status": "success",
        "filename": filename,
        "doc_type": "fpo",
        "studiengang": studiengang,
        "statistik": {
            "varianten": len(resultat.plaene),
            "module": total,
        },
    }


async def _process_modulhandbuch(
    filename: str, path: Path, db: AsyncSession
) -> dict:
    """Verarbeitet ein Modulhandbuch (PDF)."""
    try:
        resultat = parse_modulhandbuch(path)
    except Exception as e:
        logger.error("Modulhandbuch-Parsing fehlgeschlagen: %s", e)
        raise HTTPException(status_code=422, detail=f"Modulhandbuch-Parsing fehlgeschlagen: {e}")

    # Dokument speichern
    dokument = DokumentDB(
        dateiname=filename,
        doc_type="modulhandbuch",
    )
    db.add(dokument)

    # Alte Modulhandbuch-Eintraege fuer diesen Studiengang loeschen
    from sqlalchemy import delete
    studiengang = resultat.studiengang or "Unbekannt"
    await db.execute(
        delete(ModulhandbuchDB).where(ModulhandbuchDB.studiengang == studiengang)
    )

    # Module speichern
    for m in resultat.module:
        arbeitsaufwand = ""
        if m.arbeitsaufwand_gesamt:
            arbeitsaufwand = f"Gesamt: {m.arbeitsaufwand_gesamt}"
        if m.arbeitsaufwand_praesenz:
            arbeitsaufwand += f", Präsenz: {m.arbeitsaufwand_praesenz}"
        if m.arbeitsaufwand_selbst:
            arbeitsaufwand += f", Selbststudium: {m.arbeitsaufwand_selbst}"

        db.add(ModulhandbuchDB(
            studiengang=studiengang,
            name=m.name,
            kuerzel=m.kuerzel if m.kuerzel and m.kuerzel != "ggf." else None,
            niveau=m.niveau,
            studiensemester=m.studiensemester,
            modulverantwortlicher=m.modulverantwortlicher,
            sprache=m.sprache,
            zuordnung=m.zuordnung,
            sws_vorlesung=m.sws_vorlesung,
            sws_uebung=m.sws_uebung,
            sws_praktikum=m.sws_praktikum,
            sws_seminar=m.sws_seminar,
            sws_su=m.sws_su,
            arbeitsaufwand=arbeitsaufwand or None,
            credit_points=m.credit_points,
            pvl=m.pvl,
            empfohlene_voraussetzungen=m.empfohlene_voraussetzungen,
            lernziele=m.lernziele,
            inhalt=m.inhalt,
            pruefungsformen=m.pruefungsformen,
        ))

    await db.commit()

    return {
        "status": "success",
        "filename": filename,
        "doc_type": "modulhandbuch",
        "studiengang": resultat.studiengang,
        "statistik": {
            "module": len(resultat.module),
        },
    }


async def _process_pdf(
    filename: str, path: Path, db: AsyncSession
) -> dict:
    """Verarbeitet eine PDF-Datei (Veranstaltungsliste)."""
    try:
        resultat = parse_veranstaltungsliste(path)
    except Exception as e:
        logger.error("PDF-Extraktion fehlgeschlagen: %s", e)
        raise HTTPException(status_code=422, detail=f"PDF-Extraktion fehlgeschlagen: {e}")

    # Dokument in DB speichern
    dokument = DokumentDB(
        dateiname=filename,
        doc_type="veranstaltungsliste",
        semester=resultat.semester,
        stand=resultat.stand,
    )
    db.add(dokument)
    await db.flush()  # ID generieren

    # Veranstaltungen + Termine speichern
    veranstaltung_count = 0
    termin_count = 0

    for v_data in resultat.veranstaltungen:
        v_db = VeranstaltungDB(
            document_id=dokument.id,
            modul_nummer=v_data.modul_nummer,
            typ=v_data.typ,
            name=v_data.name,
        )
        db.add(v_db)
        await db.flush()

        for t_data in v_data.termine:
            t_db = TerminDB(
                veranstaltung_id=v_db.id,
                tag=t_data.tag,
                start_zeit=t_data.start_zeit,
                end_zeit=t_data.end_zeit,
                raum=t_data.raum,
                dozent_kuerzel=t_data.dozent_kuerzel,
                klassen=t_data.klassen,
                gruppe=t_data.gruppe,
                bemerkung=t_data.bemerkung,
            )
            db.add(t_db)
            termin_count += 1

        veranstaltung_count += 1

    await db.commit()

    module = gruppiere_nach_modul(resultat.veranstaltungen)

    return {
        "status": "success",
        "filename": filename,
        "doc_type": "veranstaltungsliste",
        "semester": resultat.semester,
        "stand": resultat.stand,
        "statistik": {
            "veranstaltungen": veranstaltung_count,
            "termine": termin_count,
            "module": len(module),
        },
    }


async def _process_htm(
    filename: str, path: Path, db: AsyncSession
) -> dict:
    """Verarbeitet eine HTM-Datei (Untis-Wochenplan)."""
    try:
        resultat = parse_wochenplan_htm(path)
    except Exception as e:
        logger.error("HTM-Parsing fehlgeschlagen: %s", e)
        raise HTTPException(status_code=422, detail=f"HTM-Parsing fehlgeschlagen: {e}")

    # Dokument speichern
    dokument = DokumentDB(
        dateiname=filename,
        doc_type="wochenplan_htm",
        semester=resultat.semester_info,
    )
    db.add(dokument)

    # Dozenten-Mappings speichern (UPSERT-Logik)
    neue_mappings = 0
    for m in resultat.dozenten_mappings:
        existing = await db.execute(
            select(DozentenMappingDB).where(DozentenMappingDB.kuerzel == m.kuerzel)
        )
        if existing.scalar_one_or_none() is None:
            db.add(DozentenMappingDB(kuerzel=m.kuerzel, name=m.name))
            neue_mappings += 1

    # Pruefen ob Veranstaltungsliste bereits hochgeladen wurde
    veranst_count = await db.execute(
        select(func.count(VeranstaltungDB.id))
    )
    if (veranst_count.scalar() or 0) == 0:
        await db.commit()
        return {
            "status": "warning",
            "filename": filename,
            "doc_type": "wochenplan_htm",
            "klasse": resultat.klasse,
            "dozenten_mappings": {
                "gesamt": len(resultat.dozenten_mappings),
                "neu_hinzugefuegt": neue_mappings,
            },
            "plan_eintraege": 0,
            "hinweis": "Bitte zuerst die Veranstaltungsliste (PDF) hochladen. "
                       "Der Wochenplaner konnte nicht aktualisiert werden, da keine "
                       "Veranstaltungsdaten vorhanden sind.",
        }

    # Stundenplan-Eintraege: Fuer jede HTM-Veranstaltung die passenden
    # Termine aus der DB suchen (aus der Veranstaltungsliste-Extraktion)
    from sqlalchemy.orm import selectinload

    # THGA Zeitraster fuer Slot-Zuordnung
    SLOT_ZEITEN = {
        "7:30": 0, "8:15": 1, "9:15": 2, "10:15": 3, "11:15": 4,
        "12:15": 5, "13:15": 6, "14:15": 7, "15:15": 8, "16:15": 9,
        "17:15": 10, "18:00": 11, "18:45": 12, "19:45": 13,
        "20:30": 14, "21:15": 15,
    }

    # Alle Termine aus der DB laden
    alle_veranst = await db.execute(
        select(VeranstaltungDB).options(selectinload(VeranstaltungDB.termine))
    )
    db_veranstaltungen = alle_veranst.scalars().all()

    # Dozenten-Kuerzel-Map aufbauen (Name -> Kuerzel)
    dozenten_name_to_kuerzel: dict[str, str] = {}
    for m in resultat.dozenten_mappings:
        dozenten_name_to_kuerzel[m.name.lower()] = m.kuerzel

    plan_count = 0
    nicht_gefunden = 0

    for htm_v in resultat.veranstaltungen:
        # Dozenten-Kuerzel aus Name ableiten
        dozent_kuerzel = None
        if htm_v.dozent_name:
            dozent_kuerzel = dozenten_name_to_kuerzel.get(htm_v.dozent_name.lower())

        # Passende Termine in der DB finden
        # Exaktes Matching: Modulnummer + Typ + Dozent + Gruppe
        matching_termine = []
        for db_v in db_veranstaltungen:
            if db_v.modul_nummer != htm_v.modul_nummer:
                continue
            if db_v.typ != htm_v.typ:
                continue
            for t in db_v.termine:
                # Dozent muss matchen (wenn bekannt)
                if dozent_kuerzel and t.dozent_kuerzel:
                    if t.dozent_kuerzel != dozent_kuerzel:
                        continue
                # Gruppe muss matchen (wenn bekannt)
                if htm_v.gruppe and t.gruppe:
                    if t.gruppe != htm_v.gruppe:
                        continue
                # Wenn Gruppe im HTM angegeben aber Termin keine hat -> skip
                if htm_v.gruppe and not t.gruppe:
                    continue
                matching_termine.append(t)

        if not matching_termine:
            nicht_gefunden += 1
            logger.warning(
                "Kein Termin in DB fuer: %s %s %s %s",
                htm_v.modul_nummer, htm_v.typ, htm_v.dozent_name, htm_v.gruppe,
            )
            continue

        # Bereits importierte Termine deduplizieren
        seen_plan_keys: set[str] = set()

        for termin in matching_termine:
            slot = SLOT_ZEITEN.get(termin.start_zeit, -1)
            if slot < 0:
                continue

            plan_key = f"{termin.tag}-{slot}-{htm_v.modul_nummer}-{htm_v.typ}"
            if plan_key in seen_plan_keys:
                continue
            seen_plan_keys.add(plan_key)

            db.add(PlanEintragDB(
                modul_nummer=htm_v.modul_nummer,
                veranstaltungs_typ=htm_v.typ,
                display_name=htm_v.name,
                tag=termin.tag,
                start_zeit=termin.start_zeit,
                end_zeit=termin.end_zeit,
                slot=slot,
                raum=termin.raum or htm_v.raum,
                dozent=htm_v.dozent_name,
                gruppe=htm_v.gruppe,
            ))
            plan_count += 1

    await db.commit()

    return {
        "status": "success",
        "filename": filename,
        "doc_type": "wochenplan_htm",
        "klasse": resultat.klasse,
        "dozenten_mappings": {
            "gesamt": len(resultat.dozenten_mappings),
            "neu_hinzugefuegt": neue_mappings,
        },
        "plan_eintraege": plan_count,
        "nicht_zugeordnet": nicht_gefunden,
    }
