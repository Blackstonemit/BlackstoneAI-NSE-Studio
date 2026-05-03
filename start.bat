@echo off
title NSE/BSE AI Trading Signals - Launcher
color 0A
cls

echo ============================================================
echo   NSE/BSE AI Trading Signals - Starting Application
echo ============================================================
echo.

REM ─── Check .env exists ───────────────────────────────────────
if not exist "artifacts\api-server\.env" (
    color 0C
    echo  ERROR: Environment file not found.
    echo  Please run install.bat first.
    echo.
    pause
    exit /b 1
)

REM ─── Check Node.js ───────────────────────────────────────────
node --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  ERROR: Node.js is not installed.
    echo  Please run install.bat first.
    echo.
    pause
    exit /b 1
)

REM ─── Check pnpm ──────────────────────────────────────────────
pnpm --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  ERROR: pnpm is not installed.
    echo  Please run install.bat first.
    echo.
    pause
    exit /b 1
)

echo  Starting API Server on port 8080...
start "API Server - NSE Trading" cmd /k "color 0B && echo API Server Running... && cd artifacts\api-server && pnpm run dev"

echo  Waiting for API server to initialize...
timeout /t 5 /nobreak >nul

echo  Starting Frontend Dashboard...
start "Frontend Dashboard - NSE Trading" cmd /k "color 0A && echo Frontend Server Running... && cd artifacts\market-dashboard && pnpm run dev"

echo  Waiting for frontend to initialize...
timeout /t 5 /nobreak >nul

echo.
echo ============================================================
echo   Application is starting!
echo ============================================================
echo.
echo   Dashboard:   http://localhost:5173
echo   API Server:  http://localhost:8080/api/healthz
echo.
echo   Two terminal windows have opened:
echo     - Blue window  = API Server (backend)
echo     - Green window = Frontend (dashboard)
echo.
echo   To stop the app, close both terminal windows.
echo ============================================================
echo.

REM ─── Open browser ────────────────────────────────────────────
timeout /t 3 /nobreak >nul
start http://localhost:5173

pause
