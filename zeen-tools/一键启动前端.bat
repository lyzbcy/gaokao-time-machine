@echo off
setlocal enabledelayedexpansion

REM zeen-tools local preview launcher (ASCII-only, Chinese banner comes from server.js)
REM Keep this file pure ASCII so cmd parses it regardless of code page.

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "PROJECT_ROOT=%%~fI"
set "LOCAL_PREVIEW_PORT=8091"
set "SERVER_SCRIPT=%PROJECT_ROOT%\local-preview-server.js"

cd /d "%PROJECT_ROOT%"
chcp 65001 >nul

echo ==============================================
echo   GaoKao Score Time Machine - Local Preview
echo   Project Root: %PROJECT_ROOT%
echo ==============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install it from https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo [1/3] Releasing port %LOCAL_PREVIEW_PORT% if occupied...
powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort %LOCAL_PREVIEW_PORT% -ErrorAction SilentlyContinue; if ($c) { $c | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }" >nul 2>nul

echo [2/3] Starting preview server on port %LOCAL_PREVIEW_PORT% ...
start "gk-time-machine-preview" cmd /k "chcp 65001 >nul && cd /d "%PROJECT_ROOT%" && set LOCAL_PREVIEW_PORT=%LOCAL_PREVIEW_PORT% && node "%SERVER_SCRIPT%""

echo      Waiting for server ready...
set "READY=0"
for /l %%i in (1,1,15) do (
  if "!READY!"=="0" (
    powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://127.0.0.1:%LOCAL_PREVIEW_PORT%/' -UseBasicParsing -TimeoutSec 2).StatusCode | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul && set "READY=1"
    if "!READY!"=="0" ping 127.0.0.1 -n 2 >nul
  )
)

echo [3/3] Opening browser...
if "!READY!"=="1" (
  echo.
  echo   READY. Home: http://127.0.0.1:%LOCAL_PREVIEW_PORT%/
  echo          Nav:  http://127.0.0.1:%LOCAL_PREVIEW_PORT%/nav
  echo.
  start "" "http://127.0.0.1:%LOCAL_PREVIEW_PORT%/"
) else (
  echo.
  echo [WARN] Server not ready in time. Check the spawned console window.
  echo.
)

endlocal
