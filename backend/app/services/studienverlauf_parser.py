"""
Parser fuer THGA Studienverlaufs-PDFs (grafische Kaestchen-Plaene).

Die PDFs enthalten farbige abgerundete Rechtecke (Curves in pdfplumber),
die jeweils ein Modul darstellen. Jedes Kaestchen hat:
- Eine Position (x, y) die das Semester bestimmt
- Eine Fuellfarbe (blau = ohne PVL, tuerkis = mit PVL)
- Text innerhalb = der Modulname

Dieser Parser nutzt die Curve-Bounding-Boxes um Module EXAKT zu extrahieren.
Kein manuelles Splitten noetig.
"""

import re
import logging
from dataclasses import dataclass, field
from pathlib import Path

import pdfplumber

logger = logging.getLogger(__name__)


@dataclass
class StudienverlaufModul:
    """Ein Modul im Studienverlaufsplan."""
    name: str
    semester: int
    hat_pvl: bool = False


@dataclass
class StudienverlaufResultat:
    """Ergebnis des Parsens."""
    variante: str | None = None
    studiengang: str | None = None
    anzahl_semester: int = 6
    module: list[StudienverlaufModul] = field(default_factory=list)


# Texte die keine Module sind (Legende, Header, Footer)
SKIP_TEXTS = {
    "module ohne prüfungsvorleistung",
    "module mit prüfungsvorleistung",
    "bachelorarbeit und kolloquium",  # Legende-Eintrag (nicht das Modul selbst)
}


def _clean_name(raw: str) -> str:
    """Bereinigt einen Modulnamen aus einem Kaestchen."""
    name = raw.strip()
    # Zeilenumbrueche durch Leerzeichen
    name = name.replace("\n", " ")
    # Bindestrich-Trennungen reparieren: "Regelungs- technik" -> "Regelungstechnik"
    name = re.sub(r"(\w)-\s+(\w)", r"\1\2", name)
    # Doppelte Leerzeichen
    name = re.sub(r"\s+", " ", name)
    # Encoding
    name = name.replace("\ufffd", "ü")
    return name.strip()


def parse_studienverlauf(pdf_path: str | Path) -> StudienverlaufResultat:
    """
    Parst einen THGA Studienverlaufsplan.

    Nutzt die gefuellten Curves (abgerundete Rechtecke) als Modul-Kaestchen
    und extrahiert den Text innerhalb jedes Kaestchens.
    """
    pdf_path = Path(pdf_path)
    resultat = StudienverlaufResultat()

    logger.info("Parse Studienverlauf: %s", pdf_path.name)

    # Variante aus Dateiname
    name_lower = pdf_path.name.lower()
    if "praxisbegleitend" in name_lower or "praxis" in name_lower:
        resultat.variante = "Praxisbegleitend"
    elif "vollzeit" in name_lower:
        resultat.variante = "Vollzeit"

    with pdfplumber.open(pdf_path) as pdf:
        if not pdf.pages:
            return resultat

        page = pdf.pages[0]
        text = page.extract_text() or ""

        # Studiengang + Variante aus Text
        if not resultat.variante:
            if "praxisbegleitend" in text.lower():
                resultat.variante = "Praxisbegleitend"
            elif "vollzeit" in text.lower():
                resultat.variante = "Vollzeit"

        sg_match = re.search(
            r"Bachelor\s+(?:Vollzeit|Praxisbegleitend)\s*\n?\s*(.+?)$",
            text, re.MULTILINE
        )
        if sg_match:
            resultat.studiengang = sg_match.group(1).strip()

        # 1. Semester-Spalten aus Headern bestimmen
        words = page.extract_words(keep_blank_chars=True, x_tolerance=2, y_tolerance=2)
        semester_x: dict[int, float] = {}

        for wd in words:
            if wd["top"] < 90:
                match = re.match(r"^(\d+)\.\s*$", wd["text"])
                if match:
                    sem_nr = int(match.group(1))
                    semester_x[sem_nr] = (wd["x0"] + wd["x1"]) / 2

        resultat.anzahl_semester = len(semester_x)
        if not semester_x:
            logger.warning("Keine Semester-Header gefunden")
            return resultat

        sorted_sems = sorted(semester_x.items())
        spaltenbreite = (
            sorted_sems[1][1] - sorted_sems[0][1]
            if len(sorted_sems) >= 2
            else page.width / len(sorted_sems)
        )

        # Spaltengrenzen
        sem_bounds: dict[int, tuple[float, float]] = {}
        for sem_nr, x_mitte in sorted_sems:
            sem_bounds[sem_nr] = (
                x_mitte - spaltenbreite * 0.6,
                x_mitte + spaltenbreite * 0.6,
            )

        # 2. Gefuellte Curves = Modul-Kaestchen
        filled_curves = [
            c for c in page.curves
            if c.get("fill")
            and c["x1"] - c["x0"] > 30   # Mindestbreite
            and c["bottom"] - c["top"] > 15  # Mindesthoehe
        ]

        logger.info("Gefuellte Curves (Kaestchen): %d", len(filled_curves))

        # PVL-Farbe erkennen (tuerkis vs blau)
        # Typisch: blau = (0.424, 0.647, 0.855), tuerkis = (0.416, 0.753, 0.675)
        pvl_colors = set()
        no_pvl_colors = set()

        for curve in filled_curves:
            color = curve.get("non_stroking_color")
            if color and len(color) >= 3:
                # Tuerkis: Gruen-Anteil (Index 1) > 0.7
                if color[1] > 0.7:
                    pvl_colors.add(str(color))
                else:
                    no_pvl_colors.add(str(color))

        # 3. Fuer jedes Kaestchen: Text extrahieren + Semester zuordnen
        for curve in sorted(filled_curves, key=lambda c: (c["top"], c["x0"])):
            # Text innerhalb des Kaestchens
            try:
                bbox = (curve["x0"], curve["top"], curve["x1"], curve["bottom"])
                crop = page.within_bbox(bbox)
                modul_text = (crop.extract_text() or "").strip()
            except Exception:
                continue

            if not modul_text:
                continue

            name = _clean_name(modul_text)

            # Skip: Legende, Header
            if name.lower() in SKIP_TEXTS:
                continue
            if len(name) < 3:
                continue

            # Semester zuordnen
            x_center = (curve["x0"] + curve["x1"]) / 2
            semester = None
            for sem_nr, (x_start, x_end) in sem_bounds.items():
                if x_start <= x_center <= x_end:
                    semester = sem_nr
                    break

            if not semester:
                # Kaestchen liegt ausserhalb der Semester-Spalten (Legende)
                continue

            # PVL erkennen
            color = curve.get("non_stroking_color")
            hat_pvl = False
            if color and len(color) >= 3 and color[1] > 0.7:
                hat_pvl = True

            resultat.module.append(StudienverlaufModul(
                name=name,
                semester=semester,
                hat_pvl=hat_pvl,
            ))

    # Post-Processing: Abgeschnittene Namen reparieren
    # Manche Kaestchen schneiden den Text ab (z.B. "Praxismodul Automatisie-")
    # Bekannte Korrekturen anwenden
    known_fixes = {
        "Praxismodul Automatisie-": "Praxismodul Automatisierungstechnik",
        "Praxismodul Automatisie": "Praxismodul Automatisierungstechnik",
        "Ingenieurwissenschaftliches": "Ingenieurwissenschaftliches Arbeiten",
        "Einführung in die künstliche": "Einführung in die künstliche Intelligenz",
        "Blue Engineering Nachhaltigkeit im": "Blue Engineering – Nachhaltigkeit im Ingenieurwesen",
        "NachhaltigkeitEIT": "Nachhaltige Digitalisierung",
        "Nachhaltige EIT": "Nachhaltige Digitalisierung",
    }
    for m in resultat.module:
        for partial, full in known_fixes.items():
            if m.name == partial or m.name.startswith(partial):
                m.name = full
                break
        # Allgemein: Wenn Name mit "-" endet, Bindestrich entfernen
        if m.name.endswith("-"):
            m.name = m.name[:-1].strip()

    # Duplikate entfernen
    seen = set()
    unique = []
    for m in resultat.module:
        key = f"{m.name}|{m.semester}"
        if key not in seen:
            seen.add(key)
            unique.append(m)
    resultat.module = unique

    logger.info(
        "Studienverlauf: %s, %d Semester, %d Module",
        resultat.variante, resultat.anzahl_semester, len(resultat.module),
    )

    return resultat
