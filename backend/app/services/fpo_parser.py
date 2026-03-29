"""
Parser fuer THGA Fachpruefungsordnung (FPO, PDF).

Extrahiert die Pruefungsplan-Tabellen:
- Vollzeit-Pruefungsplan (Pflichtmodule + Wahlpflichtmodule)
- Praxisbegleitend-Pruefungsplan (Pflichtmodule + Wahlpflichtmodule)

Jede Zeile: Pruefungsnummer, Modulname, CP, PVL, Pruefungsereignis, Pruefungsform, Semester
"""

import re
import logging
from dataclasses import dataclass, field
from pathlib import Path

import pdfplumber

logger = logging.getLogger(__name__)


@dataclass
class FpoModul:
    """Ein Modul aus dem FPO-Pruefungsplan."""

    pruefungsnummer: str
    name: str
    cp: float | None = None
    pvl: str | None = None  # z.B. "TN P", "TN S"
    pruefungsereignis: str | None = None  # z.B. "MP 1", "MP 28"
    pruefungsform: str | None = None  # z.B. "K", "K / M", "K / M / A"
    semester: int | None = None
    ist_wahlpflicht: bool = False
    # Fuer Kategoriezeilen (z.B. "Mathematik", "Informationstechnik")
    kategorie: str | None = None


@dataclass
class FpoPruefungsplan:
    """Ein kompletter Pruefungsplan (Vollzeit oder Praxisbegleitend)."""

    variante: str  # "Vollzeit" oder "Praxisbegleitend"
    pflichtmodule: list[FpoModul] = field(default_factory=list)
    wahlpflichtmodule: list[FpoModul] = field(default_factory=list)


@dataclass
class FpoResultat:
    """Gesamtergebnis des FPO-Parsens."""

    studiengang: str | None = None
    plaene: list[FpoPruefungsplan] = field(default_factory=list)


def _parse_cp(val: str | None) -> float | None:
    """Parst CP-Wert (deutsch: '7,5' oder '5')."""
    if not val:
        return None
    val = val.strip().replace(",", ".")
    try:
        return float(val)
    except ValueError:
        return None


def _parse_semester(val: str | None) -> int | None:
    """Parst Semester-Angabe."""
    if not val:
        return None
    match = re.search(r"(\d+)", val.strip())
    return int(match.group(1)) if match else None


def _detect_table_format(table: list[list[str | None]]) -> str:
    """
    Erkennt ob die Tabelle im BID-Format (7 Spalten) oder BII-Format (15-23 Spalten) ist.

    BID: Prüfungsnr | Modulname | CP | PVL | Prüfungsereignis | Prüfungsform | Semester
    BII-21: Modulnr | Prüfungsnr | Name | SWS(7x) | CP | PVL | Prüfungsereignis | Prüfungssemester | Prüfungsform | CP-pro-Semester...
    BII-15: Modulnr | Prüfungsnr | Name | SWS(7x) | CP | PVL | Prüfungsereignis | Prüfungsform | Vorlesungssemester
    """
    if not table:
        return "bid"
    ncols = len(table[0]) if table[0] else 0
    if ncols >= 14:
        return "bii"
    return "bid"


def _parse_pruefungsplan_tabelle(
    table: list[list[str | None]],
    ist_wahlpflicht: bool = False,
) -> list[FpoModul]:
    """Parst eine einzelne Pruefungsplan-Tabelle (BID oder BII Format)."""
    fmt = _detect_table_format(table)
    if fmt == "bii":
        return _parse_bii_tabelle(table, ist_wahlpflicht)
    return _parse_bid_tabelle(table, ist_wahlpflicht)


def _parse_bii_tabelle(
    table: list[list[str | None]],
    ist_wahlpflicht: bool = False,
) -> list[FpoModul]:
    """
    Parst BII-Format Tabelle (15-23 Spalten).

    Spalten: Modulnr | Prüfungsnr | Name | V | SU | Ü | S | P | FM | ∑SWS | CP | PVL | Prüfungsereignis | Prüfungssemester | Prüfungsform | ...
    """
    module: list[FpoModul] = []
    aktuelle_kategorie: str | None = None

    for row in table:
        if not row or len(row) < 3:
            continue

        cells = [str(c).strip() if c else "" for c in row]

        # Header-Zeilen ueberspringen
        if any(h in cells[0] for h in ["Modul-", "Modul\u2010", "Prüfungs"]):
            continue
        # Sub-header (V, SU, Ü, ...)
        if cells[0] == "" and cells[1] == "" and cells[2] == "" and any(
            c in ("V", "SU", "Ü", "WS", "SS") for c in cells[3:8]
        ):
            continue

        modulnr = cells[0].replace("\n", " ").strip()
        pruefungsnr = cells[1].replace("\n", " ").strip()
        modulname = cells[2].replace("\n", " ").strip()

        if not modulname:
            continue

        # Gesamtstudium / Summen ueberspringen
        if "Gesamtstudium" in modulname or "mindestens" in modulname or "Summe" in modulname:
            continue

        # PVL-Zeilen ueberspringen
        if modulname.startswith("PVL ") or pruefungsnr.startswith("PVL"):
            continue

        # Kategorie-Zeile: Kein Modulnr und kein Prüfungsnr, nur Name
        if not modulnr and not pruefungsnr and modulname:
            aktuelle_kategorie = modulname
            continue

        # Regulaeres Modul — Spalten ab Index 10
        cp = _parse_cp(cells[10] if len(cells) > 10 else None)
        pvl = cells[11].strip() if len(cells) > 11 and cells[11].strip() else None
        pruef_ereignis = cells[12].strip() if len(cells) > 12 and cells[12].strip() else None

        # 21-Spalten-Tabelle: 13=Prüfungssemester, 14=Prüfungsform
        # 15-Spalten-Tabelle: 13=Prüfungsform, 14=Vorlesungssemester
        ncols = len(cells)
        if ncols > 18:
            # 21+ Spalten: Semester bei 13, Form bei 14
            semester = _parse_semester(cells[13] if len(cells) > 13 else None)
            pruef_form = cells[14].strip() if len(cells) > 14 and cells[14].strip() else None
        else:
            # 15 Spalten: Form bei 13, Semester bei 14
            pruef_form = cells[13].strip() if len(cells) > 13 and cells[13].strip() else None
            semester = _parse_semester(cells[14] if len(cells) > 14 else None)

        if pruef_form == "s. WPM":
            pruef_form = "siehe Wahlpflichtmodul"

        modul = FpoModul(
            pruefungsnummer=pruefungsnr,
            name=modulname,
            cp=cp,
            pvl=pvl,
            pruefungsereignis=pruef_ereignis,
            pruefungsform=pruef_form,
            semester=semester,
            ist_wahlpflicht=ist_wahlpflicht,
            kategorie=aktuelle_kategorie,
        )
        module.append(modul)

    return module


def _parse_bid_tabelle(
    table: list[list[str | None]],
    ist_wahlpflicht: bool = False,
) -> list[FpoModul]:
    """
    Parst BID-Format Tabelle (7 Spalten).

    Spalten: Prüfungsnr | Modulname | CP | PVL | Prüfungsereignis | Prüfungsform | Semester
    """
    module: list[FpoModul] = []
    aktuelle_kategorie: str | None = None

    for row in table:
        if not row or len(row) < 2:
            continue

        # Spalten normalisieren (None -> "")
        cells = [str(c).strip() if c else "" for c in row]

        # Header-Zeilen ueberspringen
        if any(h in cells[0] for h in ["Prüfungs", "Modul-", "Modul\u2010"]):
            continue
        if cells[1] in ("", None) and cells[0] in ("", None):
            continue

        # Gesamtstudium-Zeile ueberspringen
        if "Gesamtstudium" in cells[1] or "mindestens" in cells[1]:
            continue

        pruefungsnr = cells[0].replace("\n", " ").strip()
        modulname = cells[1].replace("\n", " ").strip()

        if not modulname:
            continue

        # PVL-Zeilen ueberspringen (z.B. "PVL40050140", "PVL Digitaltechnik 1")
        if pruefungsnr.startswith("PVL") or modulname.startswith("PVL "):
            continue

        # Kategorie-Zeile erkennen (z.B. "Mathematik", "Informatik")
        # Kategorien haben CP in Spalte 2 aber keine Pruefungsnummer
        if not pruefungsnr and modulname:
            # Pruefen ob es ein Kategorie-Header ist (hat Gesamt-CP aber keine Details)
            cp_val = _parse_cp(cells[2] if len(cells) > 2 else None)
            if cp_val and cp_val >= 10:
                aktuelle_kategorie = modulname
                continue
            elif not cells[2].strip() if len(cells) > 2 else True:
                aktuelle_kategorie = modulname
                continue

        # Regulaeres Modul
        cp = _parse_cp(cells[2] if len(cells) > 2 else None)
        pvl = cells[3].strip() if len(cells) > 3 and cells[3].strip() else None
        pruef_ereignis = cells[4].strip() if len(cells) > 4 and cells[4].strip() else None
        pruef_form = cells[5].strip() if len(cells) > 5 and cells[5].strip() else None
        semester = _parse_semester(cells[6] if len(cells) > 6 else None)

        # Wahlpflicht-spezifisch: "s. WPM" bei Pruefungsform
        if pruef_form == "s. WPM":
            pruef_form = "siehe Wahlpflichtmodul"

        modul = FpoModul(
            pruefungsnummer=pruefungsnr,
            name=modulname,
            cp=cp,
            pvl=pvl,
            pruefungsereignis=pruef_ereignis,
            pruefungsform=pruef_form,
            semester=semester,
            ist_wahlpflicht=ist_wahlpflicht,
            kategorie=aktuelle_kategorie,
        )
        module.append(modul)

    return module


def parse_fpo(pdf_path: str | Path) -> FpoResultat:
    """
    Parst eine THGA Fachpruefungsordnung (PDF).

    Sucht die Pruefungsplan-Tabellen (Vollzeit + Praxisbegleitend)
    auf den letzten Seiten.
    """
    pdf_path = Path(pdf_path)
    resultat = FpoResultat()

    logger.info("Parse FPO: %s", pdf_path.name)

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            tables = page.extract_tables()

            if not tables:
                continue

            # Studiengang aus Seitentext
            if not resultat.studiengang:
                sg_match = re.search(r"Bachelorstudiengang[:\s]+(.+?)(?:\s*\(|\n)", text)
                if sg_match:
                    sg_name = sg_match.group(1).strip()
                    # Jahreszahl entfernen ("Ingenieurinformatik 2026" -> "Ingenieurinformatik")
                    sg_name = re.sub(r"\s+\d{4}$", "", sg_name)
                    resultat.studiengang = sg_name

            # Pruefungsplan-Seiten erkennen
            is_pruefungsplan = "Prüfungsplan" in text or "Prüfungsplan" in text.replace("ü", "ü")
            is_studienverlauf = "Studienverlaufsplan" in text

            # Nur Pruefungsplan-Tabellen nehmen (kompakter, alle relevanten Infos)
            if not is_pruefungsplan and not is_studienverlauf:
                continue

            # Variante erkennen
            if "Praxisbegleitend" in text or "praxisbegleitend" in text.lower():
                variante = "Praxisbegleitend"
            else:
                variante = "Vollzeit"

            # Pruefungsplan bevorzugen, Studienverlaufsplan als Fallback
            if is_studienverlauf and not is_pruefungsplan:
                # Studienverlaufsplan hat mehr Spalten aber gleiche Grundstruktur
                # Wir nehmen ihn nur wenn noch kein Plan fuer diese Variante existiert
                if any(p.variante == variante for p in resultat.plaene):
                    continue

            plan = FpoPruefungsplan(variante=variante)

            # Tabelle 1: Pflichtmodule
            if len(tables) >= 1:
                plan.pflichtmodule = _parse_pruefungsplan_tabelle(
                    tables[0], ist_wahlpflicht=False
                )

            # Tabelle 2: Wahlpflichtmodule
            if len(tables) >= 2:
                plan.wahlpflichtmodule = _parse_pruefungsplan_tabelle(
                    tables[1], ist_wahlpflicht=True
                )

            # Nur hinzufuegen wenn nicht schon ein Plan fuer diese Variante existiert
            existing = [p for p in resultat.plaene if p.variante == variante]
            if existing:
                # Pruefungsplan ersetzt Studienverlaufsplan
                if is_pruefungsplan:
                    resultat.plaene = [p for p in resultat.plaene if p.variante != variante]
                    resultat.plaene.append(plan)
            else:
                resultat.plaene.append(plan)

    logger.info(
        "FPO: %d Plaene, %s",
        len(resultat.plaene),
        ", ".join(f"{p.variante}: {len(p.pflichtmodule)}+{len(p.wahlpflichtmodule)} Module" for p in resultat.plaene),
    )

    return resultat
