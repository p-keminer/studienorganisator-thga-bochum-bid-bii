"""
Parser fuer THGA Wochenplan-HTM-Dateien (Untis 2023 Export).

Extrahiert:
1. Dozenten-Mappings (Kuerzel -> voller Name)
2. Liste aller Veranstaltungen die im Plan vorkommen (Modul, Typ, Dozent, Gruppe)

Die Tag+Zeit-Zuordnung erfolgt NICHT ueber Grid-Parsing (zu fragil wegen
rowspan/colspan), sondern ueber Lookup in den bereits extrahierten Terminen
aus der Veranstaltungsliste.
"""

import re
import logging
from dataclasses import dataclass, field
from pathlib import Path

from bs4 import BeautifulSoup, Tag

logger = logging.getLogger(__name__)


@dataclass
class DozentenMappingData:
    """Mapping von Dozenten-Kuerzel zu vollem Namen."""
    kuerzel: str
    name: str


@dataclass
class HtmVeranstaltung:
    """Eine Veranstaltung die im HTM-Wochenplan vorkommt."""
    modul_nummer: str
    typ: str
    name: str
    dozent_name: str | None
    raum: str | None
    gruppe: str | None


@dataclass
class HtmParseResultat:
    """Ergebnis des HTM-Parsens."""
    klasse: str | None = None
    semester_info: str | None = None
    dozenten_mappings: list[DozentenMappingData] = field(default_factory=list)
    veranstaltungen: list[HtmVeranstaltung] = field(default_factory=list)
    warnungen: list[str] = field(default_factory=list)


def _kuerzel_aus_name(name: str) -> str | None:
    """Erzeugt ein 3-Buchstaben-Kuerzel aus einem Nachnamen."""
    name = name.strip()
    if len(name) < 2:
        return None
    clean = re.sub(r"[^a-zA-ZäöüÄÖÜß]", "", name)
    if len(clean) < 2:
        return None
    return clean[:3].upper()


def _parse_veranstaltungszelle(table: Tag) -> dict | None:
    """
    Parst eine innere Veranstaltungs-Tabelle in einer Zelle.

    Untis-Struktur pro belegte Zelle:
      Zeile 0: ".Programmierung Ü"  (Name, font size=1)
      Zeile 1: "40050140 Ü"        (Modulnr + Typ, font size=2)
      Zeile 2: "Welp" | "266"      (Dozent | ID, font size=1)
      Zeile 3: "EDV R101" | "16)"  (Raum | Fussnote, font size=1/2)
      Zeile 4: "Gr.1"              (Gruppe, font size=1, optional)
    """
    rows = table.find_all("tr")
    if len(rows) < 3:
        return None

    # Modulnummer + Typ finden (font size="2")
    modul_nummer = None
    typ = None
    for font in table.find_all("font", {"size": "2"}):
        text = font.get_text(strip=True)
        match = re.match(r"(\d[\d.]{4,12})\s+([A-ZÜ\ufffd]{1,3})", text)
        if match:
            modul_nummer = match.group(1)
            typ_raw = match.group(2)
            typ = typ_raw.replace("\ufffd", "Ü")
            break

    if not modul_nummer:
        return None

    # Veranstaltungsname
    name = None
    first_fonts = rows[0].find_all("font", {"size": "1"})
    if first_fonts:
        name = first_fonts[0].get_text(strip=True)
        if name.startswith("."):
            name = name[1:]
        name = re.sub(r"\s+[A-ZÜ\ufffd]{1,3}\s*$", "", name)
        name = name.replace("\ufffd", "ü")

    if not name:
        name = modul_nummer

    # Dozent-Name
    dozent_name = None
    if len(rows) >= 3:
        dozent_fonts = rows[2].find_all("font", {"size": "1"})
        if dozent_fonts:
            candidate = dozent_fonts[0].get_text(strip=True)
            if (
                candidate
                and len(candidate) >= 3
                and not re.match(r"^[\d.]+$", candidate)
                and not re.match(r"^[A-Z]\d", candidate)
            ):
                dozent_name = candidate

    # Raum
    raum = None
    if len(rows) >= 4:
        raum_fonts = rows[3].find_all("font", {"size": "1"})
        if raum_fonts:
            candidate = raum_fonts[0].get_text(strip=True)
            if candidate and not re.match(r"^\d+\)$", candidate):
                raum = candidate

    # Gruppe
    gruppe = None
    if len(rows) >= 5:
        last_fonts = rows[-1].find_all("font", {"size": "1"})
        if last_fonts:
            text = last_fonts[0].get_text(strip=True)
            gr_match = re.search(r"Gr\.?\s*(\d+)", text)
            if gr_match:
                gruppe = f"Gr.{gr_match.group(1)}"

    return {
        "modul_nummer": modul_nummer,
        "typ": typ,
        "name": name,
        "dozent_name": dozent_name,
        "raum": raum,
        "gruppe": gruppe,
    }


def parse_wochenplan_htm(htm_path: str | Path) -> HtmParseResultat:
    """
    Parst eine Untis-HTM-Wochenplan-Datei.

    Extrahiert alle Veranstaltungen und Dozenten-Mappings.
    Die Tag+Zeit-Zuordnung erfolgt spaeter ueber DB-Lookup.
    """
    htm_path = Path(htm_path)
    resultat = HtmParseResultat()

    logger.info("Parse HTM-Wochenplan: %s", htm_path.name)

    try:
        content = htm_path.read_text(encoding="iso-8859-1")
    except UnicodeDecodeError:
        content = htm_path.read_text(encoding="utf-8", errors="replace")

    soup = BeautifulSoup(content, "lxml")

    # Klasse extrahieren
    klasse_element = soup.find("font", {"size": "5"})
    if klasse_element:
        klasse_text = re.sub(r"[^\w-]", "", klasse_element.get_text(strip=True))
        if klasse_text:
            resultat.klasse = klasse_text

    # Semester-Info
    semester_element = soup.find("font", {"size": "4"})
    if semester_element:
        resultat.semester_info = semester_element.get_text(strip=True)

    # Alle inneren Tabellen finden (Veranstaltungszellen)
    gesehene_dozenten: dict[str, str] = {}
    gesehene_eintraege: set[str] = set()

    for table in soup.find_all("table"):
        parsed = _parse_veranstaltungszelle(table)
        if not parsed:
            continue

        # Reservierungen ueberspringen
        if parsed["modul_nummer"].startswith("11111"):
            continue

        # Eintraege ohne Dozent UND ohne Raum sind kaputte/leere Zellen
        if not parsed["dozent_name"] and not parsed["raum"]:
            continue

        # Deduplizieren
        dedup_key = f"{parsed['modul_nummer']}|{parsed['typ']}|{parsed['dozent_name']}|{parsed['gruppe']}|{parsed['raum']}"
        if dedup_key in gesehene_eintraege:
            continue
        gesehene_eintraege.add(dedup_key)

        resultat.veranstaltungen.append(HtmVeranstaltung(
            modul_nummer=parsed["modul_nummer"],
            typ=parsed["typ"],
            name=parsed["name"].replace("\ufffd", "ü"),
            dozent_name=parsed["dozent_name"],
            raum=parsed["raum"],
            gruppe=parsed["gruppe"],
        ))

        # Dozenten-Mapping
        if parsed["dozent_name"]:
            kuerzel = _kuerzel_aus_name(parsed["dozent_name"])
            if kuerzel and kuerzel not in gesehene_dozenten:
                gesehene_dozenten[kuerzel] = parsed["dozent_name"]

    for kuerzel, name in sorted(gesehene_dozenten.items()):
        resultat.dozenten_mappings.append(
            DozentenMappingData(kuerzel=kuerzel, name=name)
        )

    logger.info(
        "HTM-Parsing: Klasse=%s, %d Veranstaltungen, %d Dozenten",
        resultat.klasse,
        len(resultat.veranstaltungen),
        len(resultat.dozenten_mappings),
    )

    return resultat
