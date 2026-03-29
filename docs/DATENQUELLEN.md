# Datenquellen-Analyse (THGA Bochum)

Dieses Dokument beschreibt die realen Datenformate der THGA-Dokumente,
die der PDF-Parser verarbeiten muss. Es dient als Referenz für die Implementierung.

## 1. Veranstaltungsliste (PDF, ~136 Seiten)

**Quelle:** Untis 2023 Studienplanexport
**Dateiname-Muster:** `Veranstaltungsliste.pdf`
**Update-Rhythmus:** Semesterweise, Stand-Datum im Header

### Globaler Header (jede Seite)
```
Techn.Hochschule Georg Agricola        Studienplan Sommersemester 2026
D-44787 Bochum, Herner Str. 45        Stand: 27.03.2026
                                                             Untis 2023
```

### Block-Struktur (pro Veranstaltung)
Jede Veranstaltung hat einen eigenen Block mit Header und Tabelle:

```
<Modulnummer> <Typ-Kürzel>          <Veranstaltungsname> <Typ-Kürzel>

Tag          Zeit         Kla.       Rm.       Le.    Text
Montag       8:15- 9:00   2BID       NTL       DIL    Gr.1 n.V.
Montag       8:15- 9:00   2BET       NTL       DIL    Gr.1 n.V.
```

### Felder im Detail

| Feld | Bedeutung | Beispiele | Parsing-Hinweis |
|------|-----------|-----------|-----------------|
| **Modulnummer** | Eindeutige ID | `40050140`, `90099110`, `2640014330` | Numerisch, 7-10 Stellen, manchmal mit Punkt (40014170.1) |
| **Typ-Kürzel** | Veranstaltungstyp | V, Ü, P, S, SU, FM | Folgt direkt nach Modulnummer (mit Leerzeichen) |
| **Veranstaltungsname** | Klartext-Name | `Programmierung`, `Höhere Mathematik 2` | Steht rechts neben dem Typ-Kürzel |
| **Tag** | Wochentag | `Montag`, `Dienstag`, `Mittwoch`, `Donnerstag`, `Freitag`, `Samstag` | Deutsch, ausgeschrieben |
| **Zeit** | Zeitslot | `8:15- 9:00`, `17:15-18:00`, `18:45-19:30` | Format: `HH:MM-HH:MM` oder `H:MM- H:MM` (Leerzeichen möglich) |
| **Kla.** | Studiengruppe | `2BID`, `4BET-AE`, `S1BMB-TPQ`, `MRPE-PE-SS` | Kodierungssystem siehe unten |
| **Rm.** | Raum | `G1 R119`, `EDV R101`, `NTL`, `G7 R101`, `EGL`, `WL` | Gebäude + Raumnummer oder Laborkürzel |
| **Le.** | Dozent (Kürzel) | `WEL`, `KEU`, `AGC`, `GIB` | 2-3 Buchstaben, Großbuchstaben |
| **Text** | Zusatzinfos | `Gr.1`, `n.V.`, `Online`, `Blockveranstaltung`, `Zusatzmodul` | Freitext, kommasepariert |

### Veranstaltungstypen

| Kürzel | Vollständig | Beschreibung |
|--------|-------------|-------------|
| **V** | Vorlesung | Klassische Frontalveranstaltung |
| **Ü** | Übung | Aufgabenbearbeitung in Gruppen |
| **P** | Praktikum | Labor-/Werkstattübung, oft mit Anwesenheitspflicht |
| **S** | Seminar | Vortragsseminar |
| **SU** | Seminaristischer Unterricht | Mischform Vorlesung+Übung |
| **FM** | Forschungsmodul | Forschungs-/Projektphase |

### Studiengruppen-Kodierung (Kla.)

Format: `<Semester><Studiengang>[-<Vertiefung>][-<Zusatz>]`

**Semester-Präfix:**
- `S1` = 1. Semester (Startkohorte)
- `2` = 2. Semester
- `4` = 4. Semester
- `6` = 6. Semester
- `8` = 8. Semester (Teilzeit)

**Studiengangs-Kürzel:**
| Kürzel | Studiengang |
|--------|-------------|
| `BID` | Digitalisierung und Informationstechnik (Bachelor) |
| `BET` | Elektro- und Informationstechnik (Bachelor) |
| `BMB` | Maschinenbau (Bachelor) |
| `BAM` | Angewandte Materialwissenschaften (Bachelor) |
| `BVT` | Verfahrenstechnik (Bachelor) |
| `BGT` | Geotechnik und Angewandte Geologie (Bachelor) |
| `BRR` | Rohstoffingenieurwesen und Recycling (Bachelor) |
| `BWI` | Wirtschaftsingenieurwesen (Bachelor) |
| `BVW` | Vermessungswesen (Bachelor) |
| `MEI` | Elektro- und Informationstechnik (Master) |
| `MMB` | Maschinenbau (Master) |
| `MWI` | Wirtschaftsingenieurwesen (Master) |
| `MGN` | Geoingenieurwesen und Nachbergbau (Master) |
| `MRPE` | Mineral Resources and Process Engineering (Master) |
| `MEIHC` | Materials Engineering and Industrial Heritage Conservation (Master) |

**Vertiefungs-Suffixe (Beispiele):**
- `-AE` = Automatisierungs- und Energietechnik
- `-AU` = Automatisierungstechnik
- `-EN` = Energietechnik
- `-TAE` = Teilzeit Elektrotechnik
- `-PQ` = Produktqualität
- `-EK` = Entwicklung und Konstruktion
- `-P` = Praxisintegriert
- `-T` = Teilzeit

### Besonderheiten

1. **Mehrere Klassen pro Zeile:** Manche Einträge haben mehrere Kla.-Einträge kommasepariert: `S1BRR, 2BRR, S1BGT`
2. **Reservierungen:** Blöcke mit `11111` sind Platzhalter (Reserviert, Res.f.Praktikum, Res.f.Seminar etc.) — können ignoriert werden
3. **n.V.:** "nach Vereinbarung" — Termine stehen noch nicht fest
4. **WPM/WP:** Wahlpflichtmodule, markiert mit `(WPM)` oder `(WP)` im Veranstaltungsnamen
5. **ZSM:** Zusatzmodule, markiert mit `(ZSM)` im Namen
6. **Gruppen:** `Gr.1`, `Gr.2` etc. — verschiedene Parallelgruppen
7. **Online:** Manche Veranstaltungen finden online statt (im Text-Feld)
8. **Blockveranstaltung:** Findet nicht wöchentlich statt

---

## 2. Wochenplan (HTM, Untis-Export)

**Quelle:** Untis 2023 Klassenplan-Export
**Dateiname-Muster:** `Kla1A_<Studiengruppe>.htm` (z.B. `Kla1A_2BID.htm`)

### Struktur
- HTML-Tabelle mit Wochentagen (Mo-Sa) als Spalten
- Zeitslots (0-15) als Zeilen, 7:30 bis 22:00
- Jede belegte Zelle enthält:
  - Veranstaltungsname
  - Modulnummer + Typ
  - **Voller Dozenten-Name** (z.B. "Dillmann", "Welp", "Agcaer")
  - Raum
  - Gruppennummer (falls zutreffend)
  - Laufende Fußnoten-Nummer

### Wert für den Parser
- **Dozenten-Mapping:** Enthält volle Namen statt Kürzel
  - `DIL` → `Dillmann`
  - `WEL` → `Welp`
  - `AGC` → `Agcaer`
  - `GEL` → `Gellhaus`
- Kann als Referenz dienen um Kürzel → volle Namen aufzulösen

---

## 3. Fachprüfungsordnung (FPO, PDF)

**Dateiname-Muster:** `FPO_BID_gesamt_06-25.pdf`

Enthält:
- Modulübersicht mit ECTS und SWS
- Prüfungsform (Klausur, Projekt, Portfolio etc.)
- Pflicht- vs. Wahlpflichtmodule
- Semester-Empfehlung
- Zulassungsvoraussetzungen

**Noch zu analysieren** — PDF-Reader-Abhängigkeit auf dem System fehlt aktuell.

---

## 4. Modulhandbuch (PDF)

**Dateiname-Muster:** `Modulhandbuch_bid_0625.pdf`

Enthält pro Modul:
- Ausführliche Beschreibung
- Lernziele / Kompetenzen
- Inhalte
- Literaturempfehlungen
- Verwendbarkeit in anderen Studiengängen

**Noch zu analysieren.**

---

## Zusammengefasste Datenfelder pro Modul (Ziel-Datenmodell)

Ein extrahiertes Modul soll folgende Informationen als vollständigen Block enthalten:

| Feld | Quelle | Pflicht |
|------|--------|---------|
| Modulnummer | Veranstaltungsliste | Ja |
| Modulname | Veranstaltungsliste | Ja |
| Veranstaltungstyp(en) | Veranstaltungsliste | Ja |
| Wochentag(e) | Veranstaltungsliste | Ja |
| Uhrzeit(en) | Veranstaltungsliste | Ja |
| Raum/-räume | Veranstaltungsliste | Ja |
| Dozent(en) - Kürzel | Veranstaltungsliste | Ja |
| Dozent(en) - voller Name | HTM-Wochenplan | Optional (Lookup) |
| Studiengruppen (Kla.) | Veranstaltungsliste | Ja |
| Gruppen-Info | Veranstaltungsliste | Optional |
| Online/Präsenz | Veranstaltungsliste (Text) | Optional |
| Blockveranstaltung? | Veranstaltungsliste (Text) | Optional |
| n.V.? | Veranstaltungsliste (Text) | Optional |
| ECTS | FPO | Ja (wenn verfügbar) |
| SWS | FPO | Ja (wenn verfügbar) |
| Prüfungsform | FPO | Optional |
| Pflicht/Wahlpflicht | FPO | Optional |
| Empfohlenes Semester | FPO | Optional |
| Modulbeschreibung | Modulhandbuch | Optional |

---

## Zeitslot-Raster der THGA

Die THGA verwendet ein spezifisches Zeitraster:

| Slot | Zeit |
|------|------|
| 0 | 7:30 - 8:15 |
| 1 | 8:15 - 9:00 |
| 2 | 9:15 - 10:00 |
| 3 | 10:15 - 11:00 |
| 4 | 11:15 - 12:00 |
| 5 | 12:15 - 13:00 |
| 6 | 13:15 - 14:00 |
| 7 | 14:15 - 15:00 |
| 8 | 15:15 - 16:00 |
| 9 | 16:15 - 17:00 |
| 10 | 17:15 - 18:00 |
| 11 | 18:00 - 18:45 |
| 12 | 18:45 - 19:30 |
| 13 | 19:45 - 20:30 |
| 14 | 20:30 - 21:15 |
| 15 | 21:15 - 22:00 |

**Besonderheit:** Ab Slot 10 wechselt das Raster (45-Minuten-Takt statt 60 Min).
Dies ist wichtig für die korrekte Darstellung im Wochenplaner.
