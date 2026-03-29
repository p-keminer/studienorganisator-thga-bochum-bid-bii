# Parser-Profile

Dieses Verzeichnis enthält hochschulspezifische Konfigurationen für die PDF-Extraktion.
Jede Hochschule bekommt eine eigene JSON-Datei, die definiert, wie deren Dokumente
strukturiert sind und welche Regex-Muster zur Extraktion verwendet werden.

## Warum Profile?

Jede Hochschule formatiert ihre Dokumente unterschiedlich:
- Tabellarische Vorlesungspläne vs. Fließtext-Modulhandbücher
- Verschiedene Bezeichnungen (ECTS vs. CP, SWS vs. Kontaktstunden)
- Unterschiedliche Raumnummern-Formate (A1.203 vs. Raum 312 vs. HG/012)

Statt diese Unterschiede im Code zu behandeln, werden sie in deklarativen
Profilen konfiguriert. Das ermöglicht Erweiterung ohne Code-Änderungen.

## Schema

```json
{
  "hochschule": "Vollständiger Name der Hochschule",
  "kuerzel": "eindeutiges-kuerzel",
  "version": "1.0.0",
  "dokument_typen": {
    "<typ-name>": {
      "tabellen_modus": true,
      "beschreibung": "Wann diesen Typ verwenden",
      "muster": {
        "modulname": "<regex>",
        "modul_nummer": "<regex>",
        "ects": "<regex>",
        "sws": "<regex>",
        "dozent": "<regex>",
        "zeit": "<regex>",
        "raum": "<regex>",
        "semester": "<regex>"
      },
      "optionale_felder": ["dozent", "semester"],
      "trennzeichen": {
        "spalten": "|",
        "bemerkung": "Falls Tabellen ein spezifisches Trennzeichen verwenden"
      }
    }
  }
}
```

## Felder im Detail

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `hochschule` | string | Offizieller Name, wird im UI angezeigt |
| `kuerzel` | string | Dateibenennung und interner Schlüssel |
| `version` | string | Semver — bei Schema-Änderungen inkrementieren |
| `dokument_typen` | object | Schlüssel = Dokumenttyp, Wert = Extraktionsregeln |
| `tabellen_modus` | boolean | `true` = pdfplumber Tabellenerkennung, `false` = Fließtext-Modus |
| `muster` | object | Regex-Patterns pro Feld (benannte Gruppen empfohlen) |
| `optionale_felder` | array | Felder, die nicht in jedem Dokument vorkommen müssen |

## Regex-Konventionen

- Verwende **benannte Gruppen** wo möglich: `(?P<ects>\d{1,2})\s*(?:ECTS|CP)`
- Teste Regex gegen mindestens 3 verschiedene Dokumente der Hochschule
- Dokumentiere Grenzfälle als Kommentar im Profil (JSON5 oder separates .md)

## Neues Profil erstellen

1. Kopiere `_vorlage.json` als `<kuerzel>.json`
2. Passe die Muster an die Dokumente deiner Hochschule an
3. Lege Test-PDFs unter `../tests/fixtures/<kuerzel>/` ab
4. Schreibe mindestens 2 Tests in `../tests/test_parser_<kuerzel>.py`
5. Erstelle einen Pull Request (siehe CONTRIBUTING.md)

## Vorhandene Profile

| Kürzel | Hochschule | Status |
|--------|-----------|--------|
| `thga` | Technische Hochschule Georg Agricola Bochum | In Entwicklung |
