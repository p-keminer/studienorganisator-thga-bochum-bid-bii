@echo off
title Studienorganisator
cd /d "%~dp0.."

echo ========================================
echo   Studienorganisator wird gestartet...
echo ========================================
echo.

echo [1/2] Frontend starten...
:: Vite starten und PID in Datei schreiben
start /MIN "" cmd /c "cd /d "%~dp0.." && npx vite --port 1420 >nul 2>nul"

echo [2/2] Backend starten...
timeout /t 3 /nobreak >nul

:: Browser oeffnen
start "" http://localhost:1420
echo.
echo   App laeuft auf http://localhost:1420
echo   Schliesst sich automatisch wenn der Browser-Tab geschlossen wird.
echo.

:: Backend BLOCKIEREND starten
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8321
cd ..

:: Backend hat sich beendet -> ALLES auf Port 1420 killen
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":1420" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>nul
)
:: Sicherheitshalber: Alle cmd.exe Fenster mit unserem Titel
taskkill /F /FI "WINDOWTITLE eq C:\WINDOWS\system32\cmd.exe" >nul 2>nul
:: Alle uebrigen node Prozesse die auf 1420 lauschen
powershell -Command "Get-NetTCPConnection -LocalPort 1420 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>nul

exit
