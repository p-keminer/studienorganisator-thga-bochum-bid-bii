"""
Parser fuer THGA Modulhandbuch (PDF).

Extrahiert pro Modul:
- Name, Kuerzel, Niveau
- Studiensemester (Vollzeit/Teilzeit, WS/SS)
- Modulverantwortliche(r) mit Titel
- Zuordnung zum Curriculum (Pflicht/Wahlpflicht + Studiengaenge)
- SWS aufgeschluesselt (V, SU, Ü, S, P)
- CP, Arbeitsaufwand
- Voraussetzungen (PO + empfohlen)
- Lernziele (Wissen, Fertigkeiten, Sozial-/Selbstkompetenz)
- Inhalt
- Pruefungsformen
"""

import re
import logging
from dataclasses import dataclass, field
from pathlib import Path

import pdfplumber

logger = logging.getLogger(__name__)


@dataclass
class ModulhandbuchEintrag:
    """Ein Modul aus dem Modulhandbuch."""

    name: str
    kuerzel: str | None = None
    niveau: str | None = None
    untertitel: str | None = None
    studiensemester: str | None = None  # z.B. "Vollzeit: WS Teilzeit: WS"
    modulverantwortlicher: str | None = None
    sprache: str | None = None
    zuordnung: str | None = None  # "Pflichtmodul in den Studiengängen BET, BID"
    sws_vorlesung: int | None = None
    sws_uebung: int | None = None
    sws_praktikum: int | None = None
    sws_seminar: int | None = None
    sws_su: int | None = None
    arbeitsaufwand_gesamt: str | None = None
    arbeitsaufwand_praesenz: str | None = None
    arbeitsaufwand_selbst: str | None = None
    credit_points: float | None = None
    pvl: str | None = None  # Pruefungsvorleistung
    empfohlene_voraussetzungen: str | None = None
    lernziele: str | None = None
    inhalt: str | None = None
    pruefungsformen: str | None = None
    # Rohtext des gesamten Blocks (fuer Debugging)
    raw_text: str | None = None


@dataclass
class ModulhandbuchResultat:
    """Gesamtergebnis des Parsens."""

    studiengang: str | None = None
    fpo_datum: str | None = None
    module: list[ModulhandbuchEintrag] = field(default_factory=list)


def _fix_encoding(text: str) -> str:
    """Fixt pdfplumber Encoding-Probleme."""
    return text.replace("\ufffd", "ü")


def _extract_int(text: str) -> int | None:
    """Extrahiert die erste Zahl aus einem Text."""
    match = re.search(r"(\d+)", text)
    return int(match.group(1)) if match else None


def _parse_modul_block(block_text: str) -> ModulhandbuchEintrag | None:
    """
    Parst einen Modul-Textblock aus dem Modulhandbuch.

    Die Bloecke haben ein konsistentes Format:
    - Feldname steht links, Wert rechts (auf derselben oder naechsten Zeile)
    - Abschnitte sind durch Ueberschriften getrennt
    """
    lines = block_text.strip().split("\n")
    if len(lines) < 5:
        return None

    # Modulname: Erste nicht-leere Zeile nach "Modulbeschreibung"
    modul_name = None
    for line in lines:
        line = line.strip()
        if line and line != "Modulbeschreibung" and not line.startswith("ggf."):
            modul_name = _fix_encoding(line)
            break

    if not modul_name:
        return None

    eintrag = ModulhandbuchEintrag(name=modul_name)
    eintrag.raw_text = block_text

    full_text = block_text

    # Kuerzel
    kuerzel_match = re.search(r"ggf\.\s*K.rzel:\s*(\S+)", full_text)
    if not kuerzel_match:
        kuerzel_match = re.search(r"K.rzel:\s*\n\s*(\w{2,6})\b", full_text)
    if kuerzel_match:
        val = kuerzel_match.group(1).strip()
        if val and len(val) <= 10:
            eintrag.kuerzel = val

    # Niveau
    niveau_match = re.search(r"Modulniveau:\s*\n?\s*(\w+)", full_text)
    if niveau_match:
        val = niveau_match.group(1).strip()
        if val not in ("ggf", "ggf."):
            eintrag.niveau = val

    # Modulverantwortliche(r)
    # BID: "Modulverantwortliche(r):\nProf. Dr..."
    # BII: "Modulverantwortliche(r) Prof. Dr..."
    verantw_match = re.search(
        r"Modulverantwortliche\(r\)[:\s]\s*\n?\s*(.+?)(?:\n\s*(?:Sprache|[Dd]eutsch|[Ee]nglisch))",
        full_text, re.DOTALL
    )
    if verantw_match:
        eintrag.modulverantwortlicher = _fix_encoding(verantw_match.group(1).strip())

    # Sprache
    if "deutsch" in full_text.lower():
        eintrag.sprache = "deutsch"
    if "englisch" in full_text.lower() or "english" in full_text.lower():
        eintrag.sprache = "deutsch/englisch" if eintrag.sprache else "englisch"

    # Studiensemester: Vollzeit UND Teilzeit erfassen
    # Format variiert:
    #   "Studiensemester:\nVollzeit: WS\nTeilzeit: WS\n"
    #   "Studiensemester: Vollzeit: SS\n"
    #   Manchmal steht Vollzeit VOR "Studiensemester:" als separate Zeile
    # Studiensemester: Vollzeit und Teilzeit erfassen
    # Format im PDF (Zeilen koennen vor oder nach "Studiensemester:" stehen):
    #   "Vollzeit: WS, SS\nStudiensemester:\nTeilzeit: WS, SS\n"
    #   "Vollzeit: WS\nStudiensemester:\nTeilzeit: WS\n"
    # Suche den gesamten Block zwischen Modulname und Modulverantwortliche
    sem_block = re.search(
        r"(?:Vollzeit:.*?\n)?Studiensemester:?\s*\n?(?:.*?\n)*?.*?(?=Modulverantwortliche)",
        full_text, re.DOTALL
    )
    if sem_block:
        sem_text = sem_block.group(0)

        def _normalize_semester(val: str) -> str:
            """Normalisiert 'Wintersemester' -> 'WS', 'Sommersemester' -> 'SS'."""
            val = re.sub(r"Sommer-\s*und\s*Wintersemester", "WS, SS", val, flags=re.IGNORECASE)
            val = re.sub(r"Winter-\s*und\s*Sommersemester", "WS, SS", val, flags=re.IGNORECASE)
            val = re.sub(r"Wintersemester", "WS", val, flags=re.IGNORECASE)
            val = re.sub(r"Sommersemester", "SS", val, flags=re.IGNORECASE)
            return val.strip()

        sem_text = _normalize_semester(sem_text)
        vz_match = re.search(r"Vollzeit:\s*((?:WS|SS)(?:\s*,\s*(?:WS|SS))*)", sem_text, re.IGNORECASE)
        tz_match = re.search(r"Teilzeit:\s*((?:WS|SS)(?:\s*,\s*(?:WS|SS))*)", sem_text, re.IGNORECASE)
        parts = []
        if vz_match:
            parts.append(f"Vollzeit: {vz_match.group(1).strip()}")
        if tz_match:
            parts.append(f"Teilzeit: {tz_match.group(1).strip()}")
        if parts:
            eintrag.studiensemester = ", ".join(parts)

    # Zuordnung zum Curriculum
    # BID: "Zuordnung zum Curriculum:\nPflichtmodul in..."
    # BII: "Zuordnung zum Pflichtmodul in BAM, BET, BII\nCurriculum"
    zuordnung_match = re.search(
        r"Zuordnung zum\s+(.+?)(?:\nCurriculum|\nLehrform)",
        full_text, re.DOTALL
    )
    if zuordnung_match:
        block = zuordnung_match.group(1)
        block = re.sub(r"Curriculum:\s*", "", block)
        zlines = [l.strip() for l in block.split("\n") if l.strip()]
        merged = " ".join(zlines)
        merged = re.sub(r"\s+", " ", merged).strip()
        if merged:
            eintrag.zuordnung = _fix_encoding(merged)

    # SWS (BID: "Vorlesung:\n2", BII: "Vorlesung 2")
    v_match = re.search(r"Vorlesung[:\s]\s*(\d+)", full_text)
    if v_match:
        eintrag.sws_vorlesung = int(v_match.group(1))

    u_match = re.search(r"bung[:\s]\s*(\d+)", full_text)
    if u_match:
        eintrag.sws_uebung = int(u_match.group(1))

    p_match = re.search(r"Praktikum[:\s]\s*(\d+)", full_text)
    if p_match:
        eintrag.sws_praktikum = int(p_match.group(1))

    s_match = re.search(r"(?<!Seminaristischer )(?<!cher )Seminar[:\s]\s*(\d+)", full_text)
    if s_match:
        eintrag.sws_seminar = int(s_match.group(1))

    su_match = re.search(r"Seminaristischer Unterricht[:\s]\s*(\d+)", full_text)
    if su_match:
        eintrag.sws_su = int(su_match.group(1))

    # Arbeitsaufwand (BID: "Gesamtarbeitsaufwand: 150h", BII: "Gesamtarbeitsaufwand 150")
    gesamt_match = re.search(r"Gesamtarbeitsaufwand[:\s]\s*(\d+)\s*h?", full_text)
    if gesamt_match:
        eintrag.arbeitsaufwand_gesamt = gesamt_match.group(1) + "h"

    praesenz_match = re.search(r"Pr.senzaufwand[:\s]\s*(\d+)\s*h?", full_text)
    if praesenz_match:
        eintrag.arbeitsaufwand_praesenz = praesenz_match.group(1) + "h"

    selbst_match = re.search(r"Selbststudienanteil[:\s]\s*(\d+)\s*h?", full_text)
    if selbst_match:
        eintrag.arbeitsaufwand_selbst = selbst_match.group(1) + "h"

    # Credit Points (deutsch: "7,5" oder "5")
    # Format BID: "Credit Points (CP):\n5" / Format ET: "Credit Points (CP) 5,0"
    cp_match = re.search(r"Credit Points \(CP\)[:\s]\s*\n?\s*(\d+[,.]?\d*)", full_text)
    if not cp_match:
        cp_match = re.search(r"Selbststudienanteil:.*?\n\s*(\d+[,.]?\d*)\s*\n", full_text)
    if cp_match:
        cp_str = cp_match.group(1).replace(",", ".")
        eintrag.credit_points = float(cp_str)

    # Seitenfooter und Seitennummern aus dem Text entfernen
    clean_text = re.sub(
        r"Modulhandbuch Bachelorstudiengang.*?Seite\s+\d+\s+von\s+\d+\s*\n?"
        r"(?:Fachpr.fungsordnung vom.*?\n)?",
        "\n", full_text
    )
    # BII-Format: "12 / 134" als Seitennummer
    clean_text = re.sub(r"\n\d+\s*/\s*\d+\s*\n", "\n", clean_text)
    # Modulname-Wiederholung am Seitenanfang entfernen
    if modul_name:
        clean_text = re.sub(
            r"\n" + re.escape(modul_name) + r"\s*\n",
            "\n", clean_text
        )

    # PVL (Pruefungsvorleistung)
    # BID: "Voraussetzungen nach\nTN Praktikum\nPrüfungsordnung:"
    # BII: "Voraussetzungen nach keine\nPrüfungsordnung"
    # BII: "Voraussetzungen nach Mindestens 120 CP...\nPrüfungsordnung..."
    pvl_match = re.search(
        r"Voraussetzungen nach\s*\n\s*(.+?)\s*\n\s*Pr.fungsordnung",
        clean_text
    )
    if not pvl_match:
        pvl_match = re.search(
            r"Voraussetzungen nach Pr.fungsordnung:?\s*\n\s*(.+?)(?:\n)",
            clean_text
        )
    if not pvl_match:
        # BII inline: "Voraussetzungen nach <value>\nPrüfungsordnung"
        pvl_match = re.search(
            r"Voraussetzungen nach\s+(.+?)(?:\s*\n\s*Pr.fungsordnung|\s*\n\s*(?:.*Pr.fungsordnung))",
            clean_text
        )
    if pvl_match:
        val = pvl_match.group(1).strip()
        # Mehrzeilige PVL-Werte zusammenfuegen
        val = re.sub(r"\s+", " ", val)
        if val and val.lower() not in ("keine", "keine.", ""):
            eintrag.pvl = _fix_encoding(val)

    # Empfohlene Voraussetzungen
    # BID: "Empfohlene Voraussetzungen:\n<Wert>"
    # BII: "Empfohlene <Wert>\nVoraussetzungen <Fortsetzung>"
    empf_match = re.search(
        r"Empfohlene\s+(?:Voraussetzungen:?\s*\n?\s*)?(.+?)(?:\n\s*\d+\s*/\s*\d+|\nModulziele|\nWissen|\nFachkompetenz|\nAbsolvent|\nNach der)",
        clean_text, re.DOTALL
    )
    if empf_match:
        val = empf_match.group(1).strip()
        # "Voraussetzungen" als Label-Rest entfernen wenn am Zeilenanfang
        val = re.sub(r"^Voraussetzungen\s+", "", val)
        val = re.sub(r"\nVoraussetzungen\s+", " ", val)
        val = re.sub(r"\s+", " ", val).strip()
        if val and val.lower() not in ("keine", "keine.", ""):
            eintrag.empfohlene_voraussetzungen = _fix_encoding(val)

    # Lernziele (alles zwischen Lernergebnisse/Wissen/Fachkompetenz und Inhalt)
    # BID: "Modulziele / Lernergebnisse:\n...Inhalt:"
    # BII: "Modulziele / Angestrebte Wissen:\nLernergebnisse ...\nInhalt ..."
    lernziele_match = re.search(
        r"(?:Modulziele.*?Lernergebnisse:?\s*\n?|Wissen:?\s*\n|Fachkompetenz\s*\n|Nach der Teilnahme)"
        r"(.+?)"
        r"(?:\nInhalt[:\s]|\nLiteratur[:\s]|\nStudien.{0,5}/|\nPr.fungsleistungen|\nPr.fungsformen)",
        clean_text, re.DOTALL
    )
    if lernziele_match:
        val = lernziele_match.group(1).strip()
        # "Lernergebnisse" Label am Anfang entfernen (BII)
        val = re.sub(r"^Lernergebnisse\s+", "", val)
        eintrag.lernziele = _fix_encoding(val)

    # Inhalt
    # BID: "Inhalt: ‐ Rekursive..."
    # BII: "Inhalt In der Modulveranstaltung..."
    inhalt_match = re.search(
        r"Inhalt[:\s]\s*(.+?)(?:\nLiteratur|\nStudien.{0,5}/|\nPr.fungsleistungen|\nPr.fungsformen)",
        clean_text, re.DOTALL
    )
    if inhalt_match:
        eintrag.inhalt = _fix_encoding(inhalt_match.group(1).strip())

    # Pruefungsformen
    # BID: "Studien‐/ Prüfungsleistungen /\nKlausur, Mündliche Prüfung\nPrüfungsformen:\n"
    #       -> Prüfungsform steht ZWISCHEN "Leistungen /" und "Prüfungsformen:"
    # BII: "Studien-/ Klausur (90 Minuten)\nPrüfungsleistungen /\nPrüfungsformen"
    #       -> Prüfungsform steht auf gleicher Zeile wie "Studien-/"
    pruef_match = re.search(
        r"Pr.fungsleistungen\s*/\s*\n(.+?)\nPr.fungsformen",
        clean_text, re.DOTALL
    )
    if pruef_match:
        val = pruef_match.group(1).strip()
        if val:
            eintrag.pruefungsformen = _fix_encoding(val.split("\n")[0].strip())

    # BII-Format: "Studien-/ Klausur (90 Minuten)\nPrüfungsleistungen"
    if not eintrag.pruefungsformen:
        pruef_match2 = re.search(
            r"Studien.{0,3}/\s+(.+?)(?:\n\s*Pr.fungsleistungen)",
            clean_text
        )
        if pruef_match2:
            val = pruef_match2.group(1).strip()
            if val:
                eintrag.pruefungsformen = _fix_encoding(val)

    return eintrag


def parse_modulhandbuch(pdf_path: str | Path) -> ModulhandbuchResultat:
    """
    Parst ein THGA Modulhandbuch (PDF).

    Teilt den Text an "Modulbeschreibung"-Markern in Bloecke auf
    und parst jeden Block einzeln.
    """
    pdf_path = Path(pdf_path)
    resultat = ModulhandbuchResultat()

    logger.info("Parse Modulhandbuch: %s", pdf_path.name)

    # Gesamten Text extrahieren
    full_text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n"

    # Studiengang + FPO-Datum aus Header
    sg_match = re.search(r"Bachelorstudiengang\s+(.+?)(?:\n|Modulhandbuch)", full_text)
    if sg_match:
        sg_name = _fix_encoding(sg_match.group(1).strip())
        # Jahreszahl entfernen ("Ingenieurinformatik 2026" -> "Ingenieurinformatik")
        sg_name = re.sub(r"\s+\d{4}$", "", sg_name)
        resultat.studiengang = sg_name

    fpo_match = re.search(r"Fachpr.fungsordnung vom\s+(\d{2}\.\d{2}\.\d{4})", full_text)
    if fpo_match:
        resultat.fpo_datum = fpo_match.group(1)

    # An "Modulbeschreibung" aufteilen
    raw_blocks = re.split(r"(?=Modulbeschreibung\s*\n)", full_text)

    # Fortsetzungsseiten erkennen und an vorherigen Block anhaengen.
    # ET-Handbuch: Jedes Modul hat 2+ Seiten, jede beginnt mit "Modulbeschreibung".
    # Seite 1: "Modulbeschreibung\n<Modulname>\nLehrveranstaltungen..."
    # Seite 2: "Modulbeschreibung\nModulziele / Angestrebte..." (Fortsetzung!)
    # Erkennungsregel: Wenn nach "Modulbeschreibung\n" direkt ein bekanntes
    # Fortsetzungsfeld kommt, ist es KEINE neue Modulbeschreibung.
    FORTSETZUNG_MARKER = (
        "Modulziele", "Inhalt", "Literatur", "Studien-/", "Kleingruppen",
    )
    blocks: list[str] = []
    for raw in raw_blocks:
        stripped = raw.strip()
        if not stripped or "Modulbeschreibung" not in stripped:
            continue
        # Erste Zeile nach "Modulbeschreibung" pruefen
        after_header = re.sub(r"^Modulbeschreibung\s*\n", "", stripped, count=1).strip()
        is_fortsetzung = any(after_header.startswith(m) for m in FORTSETZUNG_MARKER)
        if is_fortsetzung and blocks:
            # An vorherigen Block anhaengen
            blocks[-1] += "\n" + after_header
        else:
            blocks.append(raw)

    for block in blocks:
        eintrag = _parse_modul_block(block)
        if eintrag and eintrag.name != "Modulbeschreibung":
            resultat.module.append(eintrag)

    # Fallback: Kuerzel aus dem Inhaltsverzeichnis extrahieren
    # Format: "BII01 Höhere Mathematik 1 6" oder "BET30a Digitale Systeme 85"
    kuerzel_map: dict[str, str] = {}
    toc_matches = re.findall(r"(B\w{2,4}\d+\w?)\s+(.+?)\s+\d+\s*$", full_text, re.MULTILINE)
    for kuerzel, name in toc_matches:
        clean_name = _fix_encoding(name.strip())
        kuerzel_map[clean_name] = kuerzel

    for modul in resultat.module:
        if not modul.kuerzel or modul.kuerzel == "ggf.":
            modul.kuerzel = kuerzel_map.get(modul.name)

    logger.info("Modulhandbuch: %d Module extrahiert", len(resultat.module))
    return resultat
