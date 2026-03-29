# Architektur-Dokumentation

## Übersicht

Der Studienorganisator ist eine Desktop-Anwendung mit drei klar getrennten Schichten,
die über definierte Schnittstellen kommunizieren.

```
┌─────────────────────────────────────────────────────┐
│                 Tauri Shell (Rust)                    │
│  Verantwortlich: App-Lifecycle, Sidecar-Management   │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │          React Frontend (Webview)                │ │
│  │  Verantwortlich: UI, Interaktion, Darstellung    │ │
│  │                                                   │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │ │
│  │  │Dashboard │  │Wochenplan│  │ PDF-Upload    │  │ │
│  │  │(Modul-   │  │(Drag &   │  │(Dateiauswahl │  │ │
│  │  │ liste)   │  │ Drop)    │  │ + Vorschau)  │  │ │
│  │  └──────────┘  └──────────┘  └──────────────┘  │ │
│  └──────────────────┬──────────────────────────────┘ │
│                     │                                 │
│                     │ HTTP REST (localhost:8321)       │
│                     │ Content-Type: application/json   │
│                     │ + multipart/form-data (Upload)   │
│                     │                                 │
│  ┌──────────────────▼──────────────────────────────┐ │
│  │         Python FastAPI (Sidecar-Prozess)         │ │
│  │  Verantwortlich: Geschäftslogik, Datenhaltung    │ │
│  │                                                   │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │ │
│  │  │ Routers  │  │ Services │  │   Models      │  │ │
│  │  │(API-     │  │(PDF-     │  │(SQLAlchemy +  │  │ │
│  │  │ Layer)   │──│ Parser,  │──│ Pydantic)     │  │ │
│  │  │          │  │ Planung) │  │               │  │ │
│  │  └──────────┘  └──────────┘  └───────┬───────┘  │ │
│  │                                      │          │ │
│  │                              ┌───────▼───────┐  │ │
│  │                              │    SQLite      │  │ │
│  │                              │  (Lokale DB)   │  │ │
│  │                              └───────────────┘  │ │
│  └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Schicht 1: Tauri Shell (Rust)

**Dateien:** `src-tauri/`

Tauri ist der Desktop-Container. Er hat zwei Aufgaben:

1. **Webview bereitstellen** — Das React-Frontend läuft in einem nativen Webview
   (kein Chromium-Bundle wie bei Electron, daher ~10x kleiner).
2. **Sidecar-Management** — Beim App-Start wird der Python-FastAPI-Prozess als
   Kindprozess gestartet. Beim Beenden wird er sauber heruntergefahren.

### Warum Sidecar statt Rust-Backend?

Die PDF-Extraktion profitiert massiv vom Python-Ökosystem (`pdfplumber`, `PyMuPDF`).
Ein Rust-basierter Parser wäre zwar schneller, aber der Entwicklungsaufwand und
die Flexibilität für verschiedene PDF-Formate sprechen klar für Python. Der Sidecar-Ansatz
entkoppelt die Schichten: Das Backend ist auch ohne Tauri testbar (z.B. mit `pytest`).

## Schicht 2: React Frontend (TypeScript)

**Dateien:** `src/`

### Komponentenhierarchie

```
app.tsx
├── layout/app_shell.tsx          # Hauptlayout mit Sidebar + Content-Area
│   ├── layout/sidebar.tsx        # Navigation zwischen Seiten
│   └── pages/
│       ├── dashboard_page.tsx    # Modulübersicht
│       │   ├── dashboard/pdf_upload.tsx
│       │   ├── dashboard/module_list.tsx
│       │   └── dashboard/module_card.tsx
│       └── scheduler_page.tsx    # Wochenplaner
│           ├── scheduler/week_grid.tsx
│           ├── scheduler/droppable_slot.tsx
│           └── scheduler/draggable_event.tsx
```

### State-Management

- **Server-State** (Module, Schedule): React Query (`@tanstack/react-query`) —
  cached API-Antworten, synchronisiert automatisch bei Änderungen.
- **UI-State** (Sidebar offen, aktiver Filter): React `useState`/`useReducer` —
  leichtgewichtig, kein externes State-Management-Framework nötig.
- **Drag & Drop State**: `@dnd-kit` verwaltet intern — wir reagieren nur auf
  `onDragEnd`-Events und persistieren das Ergebnis via API.

### API-Kommunikation

Jede API-Interaktion läuft über typisierte Hooks:

```
src/hooks/use_modules.ts    →  GET/POST /api/modules
src/hooks/use_schedule.ts   →  GET/POST/PUT/DELETE /api/schedule
src/lib/api_client.ts       →  Basis-HTTP-Client (fetch-Wrapper mit Fehlerbehandlung)
```

## Schicht 3: Python Backend (FastAPI)

**Dateien:** `backend/`

### Schichtentrennung im Backend

```
Routers (API-Layer)      →  Nimmt Requests entgegen, validiert, delegiert
    ↓
Services (Geschäftslogik) →  PDF-Extraktion, Stundenplan-Logik, Validierung
    ↓
Models (Datenschicht)     →  SQLAlchemy ORM-Modelle, Pydantic-Schemas
    ↓
Core (Infrastruktur)      →  Konfiguration, Security, DB-Session-Management
```

**Wichtig:** Router rufen niemals direkt die Datenbank auf. Immer über einen Service.

### PDF-Extraktion: Pipeline

```
PDF-Datei
  │
  ▼
[1] Dateityp-Validierung (Magic Bytes)
  │
  ▼
[2] Text-Extraktion
  ├── pdfplumber: Tabellen (Vorlesungspläne)
  └── PyMuPDF:    Fließtext (Modulbeschreibungen)
  │
  ▼
[3] Parser-Profil laden (hochschulspezifisch, JSON)
  │
  ▼
[4] Regex + Heuristiken anwenden
  │  Felder: Modulname, Nummer, ECTS, SWS, Dozent, Raum, Zeit, Semester
  │
  ▼
[5] Konfidenz-Scoring
  │  Jedes Feld bekommt einen Score (0.0 - 1.0)
  │  Niedrige Konfidenz → Frontend markiert Feld zur manuellen Prüfung
  │
  ▼
[6] Ergebnis in DB persistieren
```

### Parser-Profile (Erweiterbarkeit)

Unter `backend/parser_profiles/` liegt pro Hochschule eine JSON-Datei.
Dies ist der zentrale Erweiterungspunkt für institutionelle Weitergabe.

```json
{
  "hochschule": "THGA Bochum",
  "kuerzel": "thga",
  "version": "1.0.0",
  "dokument_typen": {
    "vorlesungskatalog": {
      "tabellen_modus": true,
      "muster": {
        "modulname": "^([A-Z][a-zäöüß]+(?:\\s[A-Za-zäöüß]+)*)\\s*$",
        "modul_nummer": "\\b([A-Z]{2,4}\\d{3,4})\\b",
        "ects": "(\\d{1,2})\\s*(?:ECTS|CP)",
        "zeit": "(Mo|Di|Mi|Do|Fr)\\s+(\\d{1,2}:\\d{2})\\s*[-–]\\s*(\\d{1,2}:\\d{2})",
        "raum": "(?:Raum|R\\.)\\s*([A-Z]?\\d{1,3}[./]?\\d{0,3})"
      }
    }
  }
}
```

## Datenbank-Schema

```
documents ──1:N──▶ modules ──1:N──▶ schedule_entries
```

- **documents**: Hochgeladene PDF-Quelldateien mit Metadaten
- **modules**: Extrahierte Module/Veranstaltungen mit allen Feldern + Konfidenz
- **schedule_entries**: Benutzerdefinierte Wochenplan-Einträge (referenziert ein Modul)

Details zum Schema: siehe `backend/app/models/database.py` (sobald implementiert).

## Kommunikationsfluss: PDF hochladen bis Wochenplan

```
[User]                [Frontend]           [Backend]            [DB]
  │                       │                    │                  │
  │── PDF auswählen ─────▶│                    │                  │
  │                       │── POST /api/pdf ──▶│                  │
  │                       │   (multipart)      │── Validierung    │
  │                       │                    │── Extraktion     │
  │                       │                    │── INSERT ────────▶│
  │                       │◀── 200 + Module ───│                  │
  │◀── Module anzeigen ───│                    │                  │
  │                       │                    │                  │
  │── Modul korrigieren ─▶│                    │                  │
  │                       │── PUT /api/mod/1 ─▶│── UPDATE ───────▶│
  │                       │                    │                  │
  │── Modul in Plan ─────▶│                    │                  │
  │   (Drag & Drop)       │── POST /api/sched ▶│── INSERT ───────▶│
  │◀── Plan aktualisiert ─│                    │                  │
```

## Architecture Decision Records (ADRs)

Wichtige Architekturentscheidungen werden als ADRs unter `docs/adr/` dokumentiert.
Format: `NNNN-titel.md` (z.B. `0001-tauri-statt-electron.md`).

Vorlage: siehe `docs/adr/0000-vorlage.md`.
