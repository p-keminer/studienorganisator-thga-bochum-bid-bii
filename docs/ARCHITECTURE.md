<a id="top"></a>

<div align="center">

[![Deutsch](https://img.shields.io/badge/🇩🇪_Deutsch-24292f?style=for-the-badge)](#deutsch)
[![English](https://img.shields.io/badge/🇬🇧_English-24292f?style=for-the-badge)](#english)

</div>

---

<a id="deutsch"></a>

<div align="center">

`REACT / VITE` · `FASTAPI` · `SQLITE`

# Architektur und Laufzeit

Ist-Zustand der verbundenen Komponenten, Datenwege und Build-Grenzen.

[`Laufzeit`](#laufzeitpfad) ·
[`Bausteine`](#bausteine) ·
[`Persistenz`](#persistenz-und-importverhalten) ·
[`Tauri`](#tauri-status)

</div>

---

## Laufzeitpfad

```text
Browser
  │  http://127.0.0.1:1420
  ▼
React 19 + Vite
  │  relative Anfragen an /api
  ▼
Vite-Proxy
  │  http://127.0.0.1:8321
  ▼
FastAPI
  ├── SQLAlchemy + aiosqlite ──► backend/data/studienorganisator.db
  └── Upload-Ablage           ──► backend/uploads/
```

Der Frontend-Client verwendet relative `/api`-Pfade. Im derzeit funktionsfähigen
Entwicklungsbetrieb leitet ausschließlich der Vite-Proxy diese Anfragen an FastAPI weiter.
Frontend und Backend sind deshalb gemeinsam erforderlich.

`scripts/start.bat` startet Vite, öffnet den Browser und führt Uvicorn blockierend mit
`127.0.0.1:8321` aus. Der Browser sendet alle fünf Sekunden einen Heartbeat. Bleibt
45 Sekunden lang jeder Request aus, beendet sich das Backend; beim Start über das Skript
wird anschließend auch der Vite-Prozess auf Port 1420 beendet.

## Bausteine

### Frontend

| Pfad | Aufgabe |
|---|---|
| `src/app.tsx` | Navigation und sieben aktive Ansichten |
| `src/components/dashboard/` | Upload, Modulübersicht, Suche, Filter und Reset |
| `src/components/scheduler/` | Wochenplaner, Platzierung, Bearbeitung und Drag-and-drop |
| `src/components/modulhandbuch/` | Suche und Moduldetails |
| `src/components/fpo/` | Prüfungspläne nach Studiengang und Variante |
| `src/components/studienverlauf/` | Studienverlaufspläne und manuelle Semesterplanung |
| `src/components/direktlinks/` | Zwei externe THGA-Verweise |
| `src/components/hilfe/` | Integrierte Bedienungshinweise |
| `src/lib/api_client.ts` | Fetch-basierter API-Client |
| `vite.config.ts` | Entwicklungsserver und `/api`-Proxy |

Der Zustand wird mit React-Hooks sowie den vorhandenen Komponenten verwaltet. Für
Drag-and-drop wird `@dnd-kit` verwendet; eine React-Query-Schicht ist nicht vorhanden.

### Backend

| API-Gruppe | Aufgabe |
|---|---|
| `/api/pdf` | Dokumenterkennung und Upload |
| `/api/modules` | Modulübersicht, Detaildaten und Datenbank-Reset |
| `/api/schedule` | Einträge des Wochenplaners |
| `/api/modulhandbuch` | Modulhandbuchdaten und erkannte Studiengänge |
| `/api/fpo` | Prüfungspläne und erkannte Studiengänge |
| `/api/studienverlauf` | Pläne, Semester und Module |
| `/api/health`, `/api/heartbeat` | Status und lokaler Lebenszyklus |

Der Einstieg liegt in `backend/app/main.py`. Die Router unter
`backend/app/routers/` greifen über asynchrone SQLAlchemy-Sessions auf die Datenbank zu.
Die Dateien unter `backend/app/services/` enthalten die fünf formatspezifischen Parser.
Die OpenAPI-Oberflächen `/docs` und `/redoc` werden nur bei
`DEBUG_MODE=true` bereitgestellt.

## Persistenz und Importverhalten

Die SQLite-Datenbank enthält Dokumente, Veranstaltungen, Termine, Modulmetadaten,
Dozenten-Mappings, Wochenplaneinträge, Modulhandbücher, FPO-Daten und Studienverlaufspläne.

- Veranstaltungslisten werden angehängt und anschließend gemeinsam ausgewertet.
- HTM-Importe hängen Wochenplaneinträge an; ein erneuter Import kann Duplikate erzeugen.
- Modulhandbuch und FPO ersetzen vorhandene Einträge desselben erkannten Studiengangs.
- Ein Studienverlaufsimport ersetzt den Plan mit demselben Namen.
- Reguläre Uploads bleiben unter `backend/uploads/`; ein Datenbank-Reset löscht sie nicht.

Beim Start werden Tabellen angelegt. Erkennt die aktuelle Initialisierung fehlende Spalten,
kann sie betroffene Tabellen neu erstellen; das ist Entwicklungsverhalten und kein
versioniertes Migrationssystem.

## Tauri-Status

`src-tauri/` ist ein vorhandenes Tauri-2-Gerüst. Es stellt derzeit weder einen
Python-Sidecar noch Prozessverwaltung, Produktions-Proxy oder eine absolute Backend-URL
bereit. Daher gilt:

- `npm run build` baut das React-Frontend.
- `npm run tauri build` ergibt in diesem Stand keine vollständig verbundene Anwendung.
- Der dokumentierte, getestete Laufzeitpfad bleibt Vite plus FastAPI.

Die Trennung von Weboberfläche und Python-Parsern ist weiterhin mit einer späteren
Sidecar-Integration vereinbar; sie ist jedoch kein bereits implementierter Bestandteil.

<div align="right">

[`README`](../README.md#deutsch) · [`Nach oben`](#top) · [`English`](#english)

</div>

---

<a id="english"></a>

<div align="center">

`REACT / VITE` · `FASTAPI` · `SQLITE`

# Architecture and runtime

Current state of the connected components, data paths and build boundaries.

[`Runtime`](#runtime-path) ·
[`Components`](#components) ·
[`Persistence`](#persistence-and-import-behaviour) ·
[`Tauri`](#tauri-status-1)

</div>

---

## Runtime path

```text
Browser
  │  http://127.0.0.1:1420
  ▼
React 19 + Vite
  │  relative requests to /api
  ▼
Vite proxy
  │  http://127.0.0.1:8321
  ▼
FastAPI
  ├── SQLAlchemy + aiosqlite ──► backend/data/studienorganisator.db
  └── Upload storage          ──► backend/uploads/
```

The frontend client uses relative `/api` paths. In the currently functional development
setup, only Vite proxies these requests to FastAPI. Frontend and backend must therefore run
together.

`scripts/start.bat` starts Vite, opens the browser, and runs Uvicorn on
`127.0.0.1:8321`. The browser sends a heartbeat every five seconds. If no request arrives
for 45 seconds, the backend exits; when the batch script was used, it then also terminates
the Vite process listening on port 1420.

## Components

### Frontend

| Path | Responsibility |
|---|---|
| `src/app.tsx` | Navigation and seven active views |
| `src/components/dashboard/` | Upload, module overview, search, filters and reset |
| `src/components/scheduler/` | Weekly planner, placement, editing and drag-and-drop |
| `src/components/modulhandbuch/` | Search and module details |
| `src/components/fpo/` | Examination plans by programme and variant |
| `src/components/studienverlauf/` | Study plans and manual semester planning |
| `src/components/direktlinks/` | Two external THGA links |
| `src/components/hilfe/` | Built-in usage guidance |
| `src/lib/api_client.ts` | Fetch-based API client |
| `vite.config.ts` | Development server and `/api` proxy |

State is managed through React hooks and the existing components. Drag-and-drop uses
`@dnd-kit`; there is no React Query layer.

### Backend

| API group | Responsibility |
|---|---|
| `/api/pdf` | Document detection and upload |
| `/api/modules` | Module overview, details and database reset |
| `/api/schedule` | Weekly planner entries |
| `/api/modulhandbuch` | Module-handbook data and recognised programmes |
| `/api/fpo` | Examination plans and recognised programmes |
| `/api/studienverlauf` | Plans, semesters and modules |
| `/api/health`, `/api/heartbeat` | Status and local lifecycle |

The entry point is `backend/app/main.py`. Routers under `backend/app/routers/` access the
database through asynchronous SQLAlchemy sessions. Files under
`backend/app/services/` contain the five format-specific parsers. The OpenAPI interfaces
`/docs` and `/redoc` are available only when `DEBUG_MODE=true`.

## Persistence and import behaviour

The SQLite database stores documents, classes, dates, module metadata, lecturer mappings,
weekly planner entries, module handbooks, FPO data and study-progression plans.

- Class-list imports are appended and subsequently evaluated together.
- HTM imports append planner entries; importing the same file again can create duplicates.
- Module handbooks and FPOs replace existing entries for the same recognised programme.
- A study-progression import replaces the plan with the same name.
- Regular uploads remain under `backend/uploads/`; a database reset does not delete them.

Tables are created during startup. If the current initialisation detects missing columns,
it may recreate affected tables; this is development behaviour rather than a versioned
migration system.

## Tauri status

`src-tauri/` is an existing Tauri 2 scaffold. It currently provides no Python sidecar,
process management, production proxy or absolute backend URL. Therefore:

- `npm run build` builds the React frontend.
- `npm run tauri build` does not produce a fully connected application in this state.
- Vite plus FastAPI remains the documented and tested runtime path.

The separation between the web interface and Python parsers remains compatible with a
future sidecar integration, but that integration has not yet been implemented.

<div align="right">

[`README`](../README.md#english) · [`Back to top`](#top) · [`Deutsch`](#deutsch)

</div>
