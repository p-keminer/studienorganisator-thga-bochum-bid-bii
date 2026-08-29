<a id="top"></a>

<div align="center">

[![Deutsch](https://img.shields.io/badge/🇩🇪_Deutsch-24292f?style=for-the-badge)](#deutsch)
[![English](https://img.shields.io/badge/🇬🇧_English-24292f?style=for-the-badge)](#english)

</div>

---

<a id="deutsch"></a>

<div align="center">

`LOCALHOST` · `LOKALE DATEIEN` · `KEINE CLOUD`

# Lokaler Betrieb und Datenablage

Tatsächliche Schutzgrenzen, gespeicherte Dateien und Hinweise für den lokalen Einsatz.

[`Netzwerk`](#netzwerkgrenze) ·
[`Uploads`](#upload-prüfungen) ·
[`Daten`](#gespeicherte-daten) ·
[`Betrieb`](#betriebsgrenzen)

</div>

---

## Netzwerkgrenze

FastAPI wird im dokumentierten Startpfad an `127.0.0.1:8321` gebunden. Die
CORS-Freigabe umfasst den Tauri-Origin sowie `http://localhost:1420` und
`http://127.0.0.1:1420`. Der normale Betrieb benötigt weder Cloud-API noch Telemetrie;
nur die bewusst geöffneten Direktlinks verlassen die Anwendung.

Die API besitzt keine Anmeldung, Rollenverwaltung oder TLS-Terminierung. Sie ist daher
nicht für eine Bindung an `0.0.0.0`, eine Freigabe im LAN oder einen öffentlichen Betrieb
ausgelegt.

## Upload-Prüfungen

Der Upload-Endpunkt setzt aktuell folgende Grenzen:

- zugelassene Endungen: `.pdf`, `.htm` und `.html`
- Standardgröße: höchstens 50 MiB
- zusätzliche Prüfung von PDFs auf die Kennung `%PDF`
- Reduktion des Dateinamens auf Buchstaben, Ziffern, `_`, `-` und `.`

Diese Prüfungen erkennen keine inhaltlich manipulierten Hochschuldokumente und ersetzen
keine Sandbox. Es sollten nur Dateien aus vertrauenswürdiger Quelle importiert werden.

## Gespeicherte Daten

Beim Start über `scripts/start.bat` liegen die Daten standardmäßig hier:

| Inhalt | Lokaler Pfad |
|---|---|
| SQLite-Datenbank | `backend/data/studienorganisator.db` |
| regulär hochgeladene Quelldateien | `backend/uploads/` |
| optionale lokale Konfiguration | `backend/.env` |

Nur die temporäre Datei der Dokument-Vorprüfung wird automatisch gelöscht. Regulär
hochgeladene PDFs und HTM-Dateien bleiben erhalten. Die Reset-Funktionen der Oberfläche
ändern Datenbankinhalte, entfernen aber keine Quelldateien aus `backend/uploads/`.

Für eine vollständige lokale Bereinigung müssen Anwendung und Backend beendet und die
gewünschten Dateien in `backend/data/` beziehungsweise `backend/uploads/` manuell
entfernt werden. Git ignoriert `backend/data/*.db` und das gesamte Upload-Verzeichnis.

## Betriebsgrenzen

- `DEBUG_MODE=true` aktiviert die OpenAPI-Oberflächen und ausführlichere
  SQLAlchemy-Ausgaben; für den normalen Betrieb bleibt der Wert `false`.
- Die aktuelle Datenbankinitialisierung ist kein versioniertes Migrationssystem und kann
  Tabellen bei erkannten Schemaabweichungen neu erstellen. Vor wichtigen lokalen Änderungen
  sollte die Datenbank gesichert werden.
- Das vorhandene Tauri-Gerüst startet das Backend noch nicht und bildet daher keine
  zusätzliche Sicherheitsgrenze für den dokumentierten Vite-Betrieb.
- Frontend-Abhängigkeiten sind in `package.json` deklariert; der bekannte Lockfile-Versatz
  muss vor einer Verwendung von `npm ci` geprüft und aktualisiert werden. Python-Pakete
  sind in `backend/requirements.txt` festgehalten. Prüfungen sind bei Bedarf mit
  `npm audit` und `pip-audit -r backend/requirements.txt` möglich.

<div align="right">

[`README`](README.md#deutsch) · [`Nach oben`](#top) · [`English`](#english)

</div>

---

<a id="english"></a>

<div align="center">

`LOCALHOST` · `LOCAL FILES` · `NO CLOUD`

# Local operation and data storage

Actual protection boundaries, stored files and guidance for local use.

[`Network`](#network-boundary) ·
[`Uploads`](#upload-checks) ·
[`Data`](#stored-data) ·
[`Operation`](#operational-boundaries)

</div>

---

## Network boundary

In the documented startup path, FastAPI binds to `127.0.0.1:8321`. CORS allows the Tauri
origin as well as `http://localhost:1420` and `http://127.0.0.1:1420`. Normal operation
requires neither a cloud API nor telemetry; only deliberately opened direct links leave
the application.

The API has no authentication, role management or TLS termination. It is therefore not
designed to bind to `0.0.0.0`, be shared on a LAN or run publicly.

## Upload checks

The upload endpoint currently applies the following boundaries:

- accepted extensions: `.pdf`, `.htm` and `.html`
- default size limit: 50 MiB
- an additional `%PDF` signature check for PDF files
- filename reduction to letters, digits, `_`, `-` and `.`

These checks do not detect maliciously modified university documents and are not a
sandbox. Only files from trusted sources should be imported.

## Stored data

When started through `scripts/start.bat`, data is stored in these default locations:

| Content | Local path |
|---|---|
| SQLite database | `backend/data/studienorganisator.db` |
| regular uploaded source files | `backend/uploads/` |
| optional local configuration | `backend/.env` |

Only the temporary document-preflight file is deleted automatically. Regularly uploaded
PDF and HTM files remain stored. Reset actions in the interface modify database contents
but do not remove source files from `backend/uploads/`.

For complete local removal, stop the application and backend, then manually remove the
desired files under `backend/data/` and `backend/uploads/`. Git ignores
`backend/data/*.db` and the entire upload directory.

## Operational boundaries

- `DEBUG_MODE=true` enables the OpenAPI interfaces and more verbose SQLAlchemy output;
  keep it `false` for normal operation.
- The current database initialisation is not a versioned migration system and may recreate
  tables when it detects schema differences. Back up important local data before changes.
- The existing Tauri scaffold does not yet start the backend and therefore adds no
  security boundary to the documented Vite setup.
- Frontend dependencies are declared in `package.json`; the known lockfile drift must be
  reviewed and refreshed before using `npm ci`. Python packages are recorded in
  `backend/requirements.txt`. Checks can be run with `npm audit` and
  `pip-audit -r backend/requirements.txt` when required.

<div align="right">

[`README`](README.md#english) · [`Back to top`](#top) · [`Deutsch`](#deutsch)

</div>
