<a id="top"></a>

<div align="center">

[![Deutsch](https://img.shields.io/badge/🇩🇪_Deutsch-24292f?style=for-the-badge)](#deutsch)
[![English](https://img.shields.io/badge/🇬🇧_English-24292f?style=for-the-badge)](#english)

</div>

---

<a id="deutsch"></a>

<div align="center">

`5 IMPORTFORMATE` · `THGA-LAYOUTS` · `LOKALE VERARBEITUNG`

# Datenquellen und Parsergrenzen

Unterstützte Eingaben, Abhängigkeiten zwischen Importen und aktuelles Speicherverhalten.

[`Formate`](#unterstützte-formate) ·
[`Reihenfolge`](#empfohlene-reihenfolge) ·
[`Erkennung`](#erkennung-und-validierung) ·
[`Grenzen`](#gemeinsame-grenzen)

</div>

---

## Unterstützte Formate

### 1. Veranstaltungsliste

| Eigenschaft | Stand |
|---|---|
| Eingabe | PDF aus einem THGA-Untis-2023-Studienplanexport |
| Extraktion | Modulnummer, Typ, Name, Wochentag, Zeit, Raum, Lehrendenkürzel, Studiengruppen und Hinweise |
| Erkennung | Dateiname oder Begriffe wie `Untis`, `Veranstaltung` und `Studienplan` |
| Speicherung | Neue Dokumente und Veranstaltungen werden angehängt |

Der Parser liest den Seitentext mit `pdfplumber` und erwartet die bekannten
zweizeiligen Veranstaltungsköpfe, deutsche Wochentage sowie THGA-spezifische Raum-,
Labor- und Gruppenschreibweisen. Mehrere importierte Listen werden in der Übersicht
gemeinsam ausgewertet; eine semesterweite Deduplizierung findet nicht statt.

### 2. Wochenplan

| Eigenschaft | Stand |
|---|---|
| Eingabe | `.htm` oder `.html` aus Untis |
| Extraktion | Modul, Veranstaltungstyp, Name, Lehrende, Raum und Gruppe |
| Abhängigkeit | Eine passende Veranstaltungsliste muss bereits importiert sein |
| Speicherung | Erkannte Einträge werden an den Wochenplan angehängt |

Der Parser erwartet das ältere Untis-Layout mit verschachtelten Tabellen und
`font`-Elementen. Tag und Uhrzeit stammen nicht direkt aus dem HTM-Raster, sondern aus
einem Datenbankabgleich mit der Veranstaltungsliste. Die Zuordnung von ausgeschriebenen
Lehrendennamen zu Kürzeln ist heuristisch; Wiederholungsimporte können Duplikate erzeugen.

### 3. Modulhandbuch

| Eigenschaft | Stand |
|---|---|
| Eingabe | THGA-Modulhandbuch als PDF |
| Extraktion | Kürzel, CP, SWS, Verantwortliche, Semester, Zuordnung, PVL, Voraussetzungen, Lernziele, Inhalte und Prüfungsform |
| Schwerpunkt | Aktuelle BID- und BII-Layouts |
| Speicherung | Vorhandene Einträge desselben erkannten Studiengangs werden ersetzt |

Die Erkennung zerlegt das Dokument anhand der Modulbeschreibungen, führt
Fortsetzungsseiten zusammen und verwendet THGA-spezifische reguläre Ausdrücke.
Abweichende Spalten, Überschriften oder Seitenfolgen können eine Anpassung des
Python-Parsers erfordern.

### 4. Fachprüfungsordnung

| Eigenschaft | Stand |
|---|---|
| Eingabe | FPO beziehungsweise Prüfungsplan als PDF |
| Extraktion | Studiengang, Variante, Pflichtstatus, CP, PVL, Prüfungsform, Semester und Kategorie |
| Schwerpunkt | BID-Tabellen mit etwa sieben sowie BII-Tabellen mit mindestens 14 Spalten |
| Speicherung | Vorhandene Einträge desselben erkannten Studiengangs werden ersetzt |

Der Parser wertet die Prüfungs- und Studienverlaufsplantabellen aus und unterscheidet
unterstützte Vollzeit- und praxisbegleitende Varianten. Fließtextteile der Ordnung sind
keine Datenquelle für die angezeigten Tabellen.

### 5. Studienverlauf

| Eigenschaft | Stand |
|---|---|
| Eingabe | Grafischer Studienverlaufsplan als PDF |
| Extraktion | Planname, Studiengang, Semester, Modulname und PVL-Markierung |
| Auswertung | Erste Seite, Semesterüberschriften und gefüllte PDF-Kurven |
| Speicherung | Ein vorhandener Plan mit demselben Namen wird ersetzt |

Die Modulposition ergibt sich aus der Geometrie der Kästchen. Eine überwiegend grüne
Füllung wird als PVL interpretiert; einige bekannte Modulnamen werden korrigiert. Der
Parser ist deshalb besonders empfindlich gegenüber Farben, Zeichenreihenfolge und
grafischen Layoutänderungen.

## Empfohlene Reihenfolge

1. Veranstaltungsliste importieren.
2. Den dazugehörigen HTM-Wochenplan importieren.
3. Modulhandbuch und FPO in beliebiger Reihenfolge ergänzen.
4. Optional einen Studienverlaufsplan importieren oder einen Plan manuell anlegen.

Nur der HTM-Import ist technisch auf einen vorherigen Import angewiesen. Modulhandbuch,
FPO und Studienverlauf werden unabhängig davon angezeigt.

## Erkennung und Validierung

- Zulässige Endungen sind `.pdf`, `.htm` und `.html`.
- Die Standardgrenze beträgt 50 MiB pro Datei.
- PDF-Dateien werden zusätzlich auf die Kennung `%PDF` geprüft.
- Dateinamen werden vor dem Speichern auf sichere Zeichen reduziert.
- PDF-Typen werden zuerst über den Dateinamen und danach über die erste Seite erkannt.
- Kann ein PDF nicht eindeutig zugeordnet werden, wird es als Veranstaltungsliste behandelt.
- Die Vorprüfung unter `/api/pdf/detect` löscht ihre temporäre Datei; reguläre Uploads
  bleiben lokal gespeichert.

## Gemeinsame Grenzen

Alle fünf Parser enthalten Regeln für konkrete THGA- beziehungsweise Untis-Layouts. Das
Verzeichnis `backend/parser_profiles/` enthält lediglich eine nicht angebundene Vorlage:
Zur Laufzeit wird kein JSON-Profil geladen und eine neue Profildatei erweitert die Parser
nicht automatisch.

Es gibt keinen Abruf von THGA-Webseiten und keine automatische Aktualisierung. Die
extrahierten Werte sind eine lokale Arbeitshilfe; bei Abweichungen sind die offiziellen
Modulhandbücher, Fachprüfungsordnungen und Stundenpläne maßgeblich.

<div align="right">

[`README`](../README.md#deutsch) · [`Nach oben`](#top) · [`English`](#english)

</div>

---

<a id="english"></a>

<div align="center">

`5 IMPORT FORMATS` · `THGA LAYOUTS` · `LOCAL PROCESSING`

# Data sources and parser limits

Supported inputs, dependencies between imports and current storage behaviour.

[`Formats`](#supported-formats) ·
[`Order`](#recommended-order) ·
[`Detection`](#detection-and-validation) ·
[`Limits`](#shared-limits)

</div>

---

## Supported formats

### 1. Class list

| Property | Current behaviour |
|---|---|
| Input | PDF from a THGA Untis 2023 study-plan export |
| Extraction | Module number, type, name, weekday, time, room, lecturer code, study groups and notes |
| Detection | Filename or terms such as `Untis`, `Veranstaltung` and `Studienplan` |
| Storage | New documents and classes are appended |

The parser reads page text with `pdfplumber` and expects the known two-line class
headings, German weekdays and THGA-specific room, laboratory and group notation. Multiple
imported lists are evaluated together in the overview; there is no semester-wide
deduplication.

### 2. Weekly timetable

| Property | Current behaviour |
|---|---|
| Input | Untis `.htm` or `.html` |
| Extraction | Module, class type, name, lecturer, room and group |
| Dependency | A matching class list must already have been imported |
| Storage | Recognised entries are appended to the weekly planner |

The parser expects the older Untis layout with nested tables and `font` elements. Day and
time do not come directly from the HTM grid; they are resolved through a database lookup
against the class list. Mapping full lecturer names to codes is heuristic, and repeated
imports can create duplicates.

### 3. Module handbook

| Property | Current behaviour |
|---|---|
| Input | THGA module handbook PDF |
| Extraction | Code, CP, SWS, coordinator, semester, assignment, PVL, prerequisites, learning goals, content and examination form |
| Focus | Current BID and BII layouts |
| Storage | Existing entries for the same recognised programme are replaced |

Detection splits the document at module descriptions, merges continuation pages and uses
THGA-specific regular expressions. Different columns, headings or page sequences may
require changes to the Python parser.

### 4. Examination regulations

| Property | Current behaviour |
|---|---|
| Input | FPO or examination-plan PDF |
| Extraction | Programme, variant, mandatory status, CP, PVL, examination form, semester and category |
| Focus | BID tables with roughly seven columns and BII tables with at least 14 columns |
| Storage | Existing entries for the same recognised programme are replaced |

The parser evaluates examination- and study-plan tables and distinguishes the supported
`Vollzeit` and `Praxisbegleitend` variants. Narrative sections of the regulations are
not used as a source for the displayed tables.

### 5. Study progression

| Property | Current behaviour |
|---|---|
| Input | Graphical study-progression plan PDF |
| Extraction | Plan name, programme, semester, module name and PVL marker |
| Evaluation | First page, semester headings and filled PDF curves |
| Storage | An existing plan with the same name is replaced |

Module positions are derived from box geometry. Predominantly green fill is interpreted as
a PVL marker, and several known module names are corrected. This parser is particularly
sensitive to colour, character order and graphical layout changes.

## Recommended order

1. Import the class list.
2. Import its matching HTM weekly timetable.
3. Add the module handbook and FPO in either order.
4. Optionally import a study-progression plan or create one manually.

Only the HTM import technically depends on a previous import. Module handbooks, FPOs and
study-progression plans are displayed independently.

## Detection and validation

- Accepted extensions are `.pdf`, `.htm` and `.html`.
- The default limit is 50 MiB per file.
- PDF files are additionally checked for the `%PDF` signature.
- Filenames are reduced to safe characters before storage.
- PDF types are detected first from the filename and then from the first page.
- If a PDF cannot be classified unambiguously, it is treated as a class list.
- The `/api/pdf/detect` preflight deletes its temporary file; regular uploads remain
  stored locally.

## Shared limits

All five parsers contain rules for specific THGA or Untis layouts. The
`backend/parser_profiles/` directory contains only an unconnected template: no JSON
profile is loaded at runtime, and adding a profile file does not extend the parsers
automatically.

The application does not retrieve THGA webpages or update data automatically. Extracted
values are a local aid; official module handbooks, examination regulations and timetables
remain authoritative if values differ.

<div align="right">

[`README`](../README.md#english) · [`Back to top`](#top) · [`Deutsch`](#deutsch)

</div>
