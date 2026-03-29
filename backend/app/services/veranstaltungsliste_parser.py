"""
Parser fuer die THGA Veranstaltungsliste (PDF, Untis 2023 Export).

Extrahiert alle Veranstaltungsbloecke mit Terminen, Dozenten, Raeumen
und Studiengruppen aus dem PDF.

WICHTIG: Das PDF-Format hat Block-Header auf ZWEI Zeilen:
  Zeile 1: "<Modulnummer> <Typ>"       z.B. "40050140 V"
  Zeile 2: "<Name> <Typ>"              z.B. "Programmierung V"

Achtung: pdfplumber extrahiert 'Ü' manchmal als '\ufffd' (Replacement Character).
"""

import re
import logging
from dataclasses import dataclass, field
from pathlib import Path

import pdfplumber

logger = logging.getLogger(__name__)


# ============================================================
# Datenklassen
# ============================================================


@dataclass
class TerminData:
    """Ein einzelner Termin aus der Veranstaltungsliste."""

    tag: str
    start_zeit: str
    end_zeit: str
    klassen: list[str] = field(default_factory=list)
    raum: str | None = None
    dozent_kuerzel: str | None = None
    gruppe: str | None = None
    bemerkung: str | None = None


@dataclass
class VeranstaltungData:
    """Ein Veranstaltungsblock (Header + Terminliste)."""

    modul_nummer: str
    typ: str
    name: str
    termine: list[TerminData] = field(default_factory=list)


@dataclass
class ExtraktionsResultat:
    """Gesamtergebnis der Extraktion."""

    semester: str | None = None
    stand: str | None = None
    veranstaltungen: list[VeranstaltungData] = field(default_factory=list)
    warnungen: list[str] = field(default_factory=list)


# ============================================================
# Konstanten
# ============================================================

WOCHENTAG_MAP = {
    "Montag": "Mo",
    "Dienstag": "Di",
    "Mittwoch": "Mi",
    "Donnerstag": "Do",
    "Freitag": "Fr",
    "Samstag": "Sa",
}

# Gueltige Typ-Kuerzel (inkl. Ersetzungszeichen fuer Ü)
# pdfplumber gibt 'Ü' manchmal als '\ufffd' aus
GUELTIGE_TYPEN = {"V", "Ü", "P", "S", "SU", "FM", "VÜ", "VÜP", "\ufffd", "V\ufffd", "V\ufffdP"}

# Mapping: Ersetzungszeichen -> korrekter Typ
TYP_FIX = {
    "\ufffd": "Ü",
    "V\ufffd": "VÜ",
    "V\ufffdP": "VÜP",
}

# Regex: Zeile 1 des Block-Headers: "<Modulnummer> <Typ>"
# Beispiele: "40050140 V", "52014100 Ü", "11111 VÜP", "(WPM) 40060110 V"
HEADER_LINE1_RE = re.compile(
    r"^(?:\((?:WPM|WP|ZSM|W|Z)\)\s*)?"  # Optionales Praefix
    r"(\d[\d.]{4,12})"  # Modulnummer
    r"\s+"
    r"([A-ZÜ\ufffd]{1,3})"  # Typ (inkl. Replacement-Char)
    r"\s*$"  # Nichts mehr danach (wichtig!)
)

# Regex: Terminzeile
TERMIN_RE = re.compile(
    r"^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag)"
    r"\s+"
    r"(\d{1,2}:\d{2})"
    r"\s*[-–]\s*"
    r"(\d{1,2}:\d{2})"
    r"\s+"
    r"(.+)"
)

# Regex: Tabellenheader
TABELLEN_HEADER_RE = re.compile(r"^Tag\s+Zeit\s+Kla\.")

# Regex: Seitenheader / Footer
SKIP_RE = re.compile(
    r"Techn\.Hochschule|Bochum.*Herner|Studienplan\s+\w+semester|"
    r"Stand:\s+\d|Untis\s+\d|Planung:\s*\(|^Seite\s+\d|^\d{1,2}\.\d\.\d{4}$"
)

# Reservierungen (11111-Bloecke)
RESERVIERUNG_RE = re.compile(r"^11111")

# Regex fuer Termin-Rest-Parsing: Klasse, Raum, Dozent erkennen
RAUM_PATTERN = re.compile(r"^(?:G\d\s*R\d{3}|EDV\s*R\d{3}|G\d\s*R\d{3})")
RAUM_LABOR_PATTERN = re.compile(
    r"^(?:NTL|EGL|EML|SRL|MPL|SBL|MVL|PPL|WL|GTL|ITL|TCVL|MSRL/ML|"
    r"EDV R\d{3}|G1 R\d{3}|G7 R\d{3}|DGL|SEL|PL|KSM-Labor)$"
)
GRUPPE_RE = re.compile(r"Gr\.?\s*(\d+)")


# ============================================================
# Termin-Zeile parsen
# ============================================================


def _fix_umlaute(text: str) -> str:
    """
    Ersetzt \ufffd (Replacement Character) durch den wahrscheinlichsten Umlaut.

    Heuristik: Wenn \ufffd am Wortanfang oder alleinstehend steht -> Ü (gross).
    Sonst -> ü (klein). Deckt die haeufigsten Faelle in THGA-PDFs ab:
    - "Übung" (gross am Anfang)
    - "Prüf- und Testsysteme" (klein im Wort)
    - "Unternehmensführung" (klein im Wort)
    """
    if "\ufffd" not in text:
        return text

    result = []
    for i, char in enumerate(text):
        if char == "\ufffd":
            # Am Wortanfang oder nach Leerzeichen/Satzanfang -> gross
            if i == 0 or (i > 0 and text[i - 1] in " \t\n(-/"):
                result.append("Ü")
            else:
                result.append("ü")
        else:
            result.append(char)

    return "".join(result)


def _parse_termin_rest(rest: str) -> dict:
    """
    Parst den Rest einer Terminzeile: "2BET G1 R119 WEL Gr.1 n.V."

    Spalten sind durch Leerzeichen getrennt. Wir nutzen die Reihenfolge:
    Kla. -> Rm. -> Le. -> Text (wie im PDF-Header angegeben).
    """
    result = {
        "klassen": [],
        "raum": None,
        "dozent_kuerzel": None,
        "gruppe": None,
        "bemerkung": None,
    }

    # Tokenize: durch 2+ Leerzeichen oder Tab trennen
    # Aber auch einige Tokens sind nur durch 1 Leerzeichen getrennt
    # Daher: Tokens einzeln durchgehen
    tokens = rest.split()
    if not tokens:
        return result

    bemerkungen = []
    i = 0

    while i < len(tokens):
        token = tokens[i]

        # "Seite XX" am Ende ueberspringen
        if token == "Seite" and i + 1 < len(tokens) and tokens[i + 1].isdigit():
            break

        # Raum: "G1 R119" (zwei Tokens) oder "G7 R101"
        if re.match(r"^G\d$", token) and i + 1 < len(tokens) and re.match(r"^R\d{3}$", tokens[i + 1]):
            result["raum"] = f"{token} {tokens[i + 1]}"
            i += 2
            continue

        # Raum: "EDV R101" (zwei Tokens)
        if token == "EDV" and i + 1 < len(tokens) and re.match(r"^R\d{3}$", tokens[i + 1]):
            result["raum"] = f"{token} {tokens[i + 1]}"
            i += 2
            continue

        # Raum: Labor-Kuerzel (einzelnes Token)
        if RAUM_LABOR_PATTERN.match(token) and result["raum"] is None:
            # Nur als Raum erkennen wenn noch kein Raum gefunden
            # und nicht wie ein Klassen-Code aussieht
            if not re.match(r"^[S]?\d", token):
                result["raum"] = token
                i += 1
                continue

        # Klassen-Code: beginnt mit Ziffer oder S+Ziffer, hat Grossbuchstaben
        # z.B. "2BID", "4BET-AE", "S1BMB-TPQ"
        # Kann auch kommasepariert sein: "S1BID, 2BET-TAE"
        if re.match(r"^[S]?\d[A-Z]", token) or re.match(r"^[2468][A-Z]{2}", token):
            # Kommaseparierte Klassen zusammenfuehren
            klasse_str = token
            while (
                i + 1 < len(tokens)
                and (tokens[i + 1].startswith(",") or tokens[i + 1].endswith(","))
            ):
                i += 1
                klasse_str += " " + tokens[i]
            # Auch naechstes Token pruefen wenn es ein Klassen-Code ist
            # nach einem Komma
            if klasse_str.endswith(",") and i + 1 < len(tokens):
                i += 1
                klasse_str += " " + tokens[i]

            for kla in klasse_str.replace(",", " ").split():
                kla = kla.strip()
                if kla and re.match(r"^[S]?\d?[A-Z]", kla):
                    result["klassen"].append(kla)
            i += 1
            continue

        # MRPE/MEIHC Klassen (Master, beginnen mit Buchstaben)
        if re.match(r"^(?:MRPE|MEIHC|TUT\d)", token):
            result["klassen"].append(token)
            i += 1
            continue

        # Dozent: 2-4 Grossbuchstaben (nach Raum, vor Text)
        if (
            re.match(r"^[A-ZÄÖÜ]{2,4}$", token)
            and result["dozent_kuerzel"] is None
            and result["raum"] is not None  # Dozent kommt nach Raum
        ):
            result["dozent_kuerzel"] = token
            i += 1
            continue

        # Auch Dozent erkennen wenn noch kein Raum (manche Zeilen haben keinen Raum)
        if (
            re.match(r"^[A-ZÄÖÜ]{2,4}$", token)
            and result["dozent_kuerzel"] is None
            and len(result["klassen"]) > 0  # Aber nach mindestens einer Klasse
            and token not in {"SU", "FM", "PVL", "TN"}  # Keine Keywords
        ):
            result["dozent_kuerzel"] = token
            i += 1
            continue

        # Gruppen-Info
        gruppe_match = GRUPPE_RE.match(token)
        if gruppe_match:
            result["gruppe"] = f"Gr.{gruppe_match.group(1)}"
            i += 1
            continue
        # "Gr.1" als zusammengesetztes Token
        if token.startswith("Gr") and i + 1 < len(tokens) and tokens[i + 1][0].isdigit():
            result["gruppe"] = f"Gr.{tokens[i + 1].rstrip('.')}"
            i += 2
            continue

        # Alles andere: Bemerkung
        bemerkungen.append(token)
        i += 1

    if bemerkungen:
        result["bemerkung"] = " ".join(bemerkungen).strip() or None

    return result


# ============================================================
# Hauptparser
# ============================================================


def parse_veranstaltungsliste(pdf_path: str | Path) -> ExtraktionsResultat:
    """
    Parst eine THGA Veranstaltungsliste (Untis 2023 PDF-Export).

    Das PDF hat Block-Header auf ZWEI Zeilen:
      Zeile 1: "<Modulnummer> <Typ>"
      Zeile 2: "<Name> <Typ>"
    Danach: Tabellenheader + Terminzeilen.
    """
    pdf_path = Path(pdf_path)
    resultat = ExtraktionsResultat()

    logger.info("Starte Extraktion: %s", pdf_path.name)

    # Alle Zeilen aus allen Seiten sammeln
    alle_zeilen: list[str] = []

    with pdfplumber.open(pdf_path) as pdf:
        for seite in pdf.pages:
            text = seite.extract_text()
            if text:
                if resultat.semester is None:
                    sem_match = re.search(r"Studienplan\s+((?:Sommer|Winter)semester\s+\d{4})", text)
                    if sem_match:
                        resultat.semester = sem_match.group(1)
                    stand_match = re.search(r"Stand:\s+(\d{2}\.\d{2}\.\d{4})", text)
                    if stand_match:
                        resultat.stand = stand_match.group(1)

                alle_zeilen.extend(text.split("\n"))

    logger.info("Extrahierte %d Textzeilen", len(alle_zeilen))

    # State Machine: Zeilen durchgehen
    aktuelle_veranstaltung: VeranstaltungData | None = None
    ueberspringe_block = False
    pending_header_line1: tuple[str, str] | None = None  # (modul_nummer, typ)

    for zeile in alle_zeilen:
        zeile = zeile.strip()
        if not zeile:
            continue

        # Skip-Zeilen: Seitenheader, Footer, Tabellenheader
        if SKIP_RE.search(zeile):
            continue
        if TABELLEN_HEADER_RE.match(zeile):
            continue

        # === Zwei-Zeilen-Header-Erkennung ===

        # Zeile 1: "<Modulnummer> <Typ>" (nur Nummer + Kuerzel, sonst nichts)
        header1_match = HEADER_LINE1_RE.match(zeile)
        if header1_match:
            modul_nummer = header1_match.group(1)
            typ_raw = header1_match.group(2)

            # Reservierungen ueberspringen
            if RESERVIERUNG_RE.match(modul_nummer):
                ueberspringe_block = True
                pending_header_line1 = None
                continue

            # Typ bereinigen (Ü-Replacement-Fix)
            typ = TYP_FIX.get(typ_raw, typ_raw)

            pending_header_line1 = (modul_nummer, typ)
            continue

        # Zeile 2: "<Name> <Typ>" (nach einer Zeile 1)
        if pending_header_line1 is not None:
            modul_nummer, typ = pending_header_line1
            pending_header_line1 = None

            # Name bereinigen: Typ-Suffix am Ende entfernen
            name = zeile.strip()
            # Entferne wiederholten Typ am Ende: "Programmierung V" -> "Programmierung"
            # Beachte: Typ kann auch \ufffd sein
            name = re.sub(r"\s+[A-ZÜ\ufffd]{1,3}\s*$", "", name)
            # Praefix-Tags entfernen
            name = re.sub(r"^\((?:WPM|WP|ZSM|W|Z)\)\s*", "", name)
            # Sonderfall: "Res.f.Vorlesung" etc. (Reservierungs-Namen) -> skip
            if name.startswith("Res.f.") or name.startswith("Reserviert"):
                ueberspringe_block = True
                continue

            ueberspringe_block = False
            aktuelle_veranstaltung = VeranstaltungData(
                modul_nummer=modul_nummer,
                typ=typ,
                name=name,
            )
            resultat.veranstaltungen.append(aktuelle_veranstaltung)
            continue

        # Pending Header verwerfen falls Name-Zeile nicht kam
        pending_header_line1 = None

        # Uebersprungene Bloecke ignorieren
        if ueberspringe_block:
            continue

        # === Terminzeilen ===
        if aktuelle_veranstaltung is not None:
            termin_match = TERMIN_RE.match(zeile)
            if termin_match:
                tag_lang = termin_match.group(1)
                start_zeit = termin_match.group(2)
                end_zeit = termin_match.group(3)
                rest = termin_match.group(4)

                tag_kurz = WOCHENTAG_MAP.get(tag_lang, tag_lang[:2])
                parsed = _parse_termin_rest(rest)

                termin = TerminData(
                    tag=tag_kurz,
                    start_zeit=start_zeit,
                    end_zeit=end_zeit,
                    klassen=parsed["klassen"],
                    raum=parsed["raum"],
                    dozent_kuerzel=parsed["dozent_kuerzel"],
                    gruppe=parsed["gruppe"],
                    bemerkung=parsed["bemerkung"],
                )
                aktuelle_veranstaltung.termine.append(termin)

    # Post-Processing: Encoding-Fix in allen Veranstaltungen
    # pdfplumber gibt Ü/ü/Ö/ö/Ä/ä manchmal als \ufffd aus
    for v in resultat.veranstaltungen:
        v.typ = TYP_FIX.get(v.typ, v.typ)
        v.name = _fix_umlaute(v.name)
        for t in v.termine:
            if t.bemerkung:
                t.bemerkung = _fix_umlaute(t.bemerkung)

    logger.info(
        "Extraktion abgeschlossen: %d Veranstaltungen, %d Termine",
        len(resultat.veranstaltungen),
        sum(len(v.termine) for v in resultat.veranstaltungen),
    )

    return resultat


def gruppiere_nach_modul(
    veranstaltungen: list[VeranstaltungData],
) -> dict[str, list[VeranstaltungData]]:
    """Gruppiert Veranstaltungen nach Modulnummer."""
    module: dict[str, list[VeranstaltungData]] = {}
    for v in veranstaltungen:
        module.setdefault(v.modul_nummer, []).append(v)
    return module
