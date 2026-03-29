# Sicherheitsrichtlinien

## Grundprinzipien

Der Studienorganisator verarbeitet potenziell sensible Studiendaten (Prüfungsordnungen,
persönliche Stundenpläne). Die folgenden Sicherheitsmaßnahmen gelten für alle Beiträge.

### 1. Keine hartkodierten Geheimnisse

**Regel:** Keinerlei Passwörter, API-Keys, Tokens oder Pfade zu sensiblen Daten im Quellcode.

- Alle konfigurierbaren Werte gehören in Umgebungsvariablen (`.env`-Datei)
- `.env` ist in `.gitignore` eingetragen und wird **niemals** committed
- `.env.example` enthält nur Platzhalter mit Beschreibung

```python
# FALSCH — niemals so:
DATABASE_URL = "sqlite:///C:/Users/student/studienplaner.db"

# RICHTIG — aus Umgebungsvariable:
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///data/studienorganisator.db")
```

### 2. Eingabevalidierung

**Regel:** Alle Eingaben werden validiert, bevor sie verarbeitet werden.

- **PDF-Upload:**
  - Dateityp-Prüfung (Magic Bytes, nicht nur Dateiendung)
  - Maximale Dateigröße (konfigurierbar, Standard: 50 MB)
  - Dateinamen werden sanitisiert (keine Pfad-Traversal-Angriffe wie `../../etc/passwd`)
- **API-Eingaben:**
  - Pydantic-Modelle validieren alle Request-Bodies
  - Pfadparameter und Query-Strings werden typisiert und begrenzt
- **Frontend:**
  - Kein `dangerouslySetInnerHTML` ohne Sanitisierung
  - Nutzereingaben in Modulnamen/Notizen werden escaped

### 3. SQL-Injection-Prävention

**Regel:** Ausschließlich parametrisierte Queries über SQLAlchemy ORM.

```python
# FALSCH — anfällig für SQL-Injection:
db.execute(f"SELECT * FROM modules WHERE name = '{user_input}'")

# RICHTIG — parametrisiert:
db.query(Module).filter(Module.name == user_input).all()
```

### 4. Dateisystem-Sicherheit

**Regel:** Uploads und generierte Dateien bleiben in kontrollierten Verzeichnissen.

- Upload-Verzeichnis ist konfigurierbar, aber standardmäßig innerhalb des App-Datenordners
- Keine Pfad-Traversal: Dateinamen werden auf erlaubte Zeichen gefiltert
- Temporäre Dateien werden nach Verarbeitung gelöscht
- Zugriffsrechte: Dateien sind nur für den aktuellen Benutzer lesbar

### 5. Netzwerk-Sicherheit

**Regel:** Die App läuft lokal — minimale Angriffsfläche.

- FastAPI bindet standardmäßig nur an `127.0.0.1` (localhost), nicht an `0.0.0.0`
- Kein externer Netzwerkverkehr im Normalbetrieb
- CORS ist auf den Tauri-Webview-Origin beschränkt
- Keine Telemetrie, keine Analytics, keine externen CDN-Einbindungen

### 6. Dependency-Management

**Regel:** Abhängigkeiten werden geprüft und versioniert.

- `requirements.txt` und `package-lock.json` werden eingecheckt (reproduzierbare Builds)
- Regelmäßige Prüfung auf bekannte Schwachstellen:
  - Python: `pip-audit` oder `safety check`
  - Node.js: `npm audit`
- Minimale Abhängigkeiten — jede neue Dependency braucht eine Begründung

### 7. Sichere Konfiguration

**Regel:** Sicherheitsrelevante Defaults sind restriktiv.

```python
# backend/app/core/config.py — Auszug
ALLOWED_UPLOAD_EXTENSIONS = {".pdf"}
MAX_UPLOAD_SIZE_MB = 50
CORS_ALLOWED_ORIGINS = ["tauri://localhost", "http://localhost:1420"]
API_HOST = "127.0.0.1"      # Nur localhost
API_PORT = 8321
DEBUG_MODE = False           # Explizit aktivieren für Entwicklung
```



