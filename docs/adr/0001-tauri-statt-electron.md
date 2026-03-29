# ADR-0001: Tauri statt Electron als Desktop-Shell

## Status

Akzeptiert

## Kontext

Die Anwendung soll als Desktop-App laufen, die ein React-Frontend in einem
nativen Fenster darstellt und einen Python-Backend-Prozess verwaltet.
Die zwei etablierten Optionen sind Electron und Tauri.

## Entscheidung

Wir verwenden **Tauri 2.x** als Desktop-Shell.

## Alternativen

| Alternative | Vorteile | Nachteile | Grund für Ablehnung |
|-------------|----------|-----------|---------------------|
| Electron | Riesiges Ökosystem, breite Dokumentation | ~150 MB Bundle (Chromium), hoher RAM-Verbrauch, Node.js im Produktivbetrieb (zusätzliche Angriffsfläche) | Unverhältnismäßig groß für eine lokale Utility-App |
| Reine Web-App | Kein nativer Build nötig | Kein Dateisystem-Zugriff ohne Server, kein Sidecar-Management | Offline-Fähigkeit und PDF-Dateizugriff erfordern nativen Zugang |

## Konsequenzen

### Positiv
- Bundle-Größe ~5-10 MB statt ~150 MB
- Geringerer Speicherverbrauch (nutzt System-Webview statt gebündeltem Chromium)
- Sidecar-API in Tauri 2.x nativ unterstützt
- Rust-Backend für spätere Performance-Optimierungen nutzbar

### Negativ
- Rust-Kenntnisse nötig für Tauri-Konfiguration (minimal, da Hauptlogik in Python)
- System-Webview kann je nach OS/Version leicht unterschiedlich rendern
- Kleineres Ökosystem als Electron (weniger Plugins, weniger StackOverflow-Antworten)

### Risiken
- Tauri 2.x ist neuer als Electron — potenziell weniger stabil bei Edge-Cases
