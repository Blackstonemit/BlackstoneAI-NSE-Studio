@echo off
title NSE/BSE AI Trading Signals - Installer
color 0A
cls

echo ============================================================
echo   NSE/BSE AI Trading Signals - Windows Installer
echo ============================================================
echo.

REM ─── Step 1: Check Node.js ───────────────────────────────────
echo [1/6] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  ERROR: Node.js is not installed.
    echo.
    echo  Please install Node.js v18 or higher from:
    echo  https://nodejs.org/en/download
    echo.
    echo  After installing Node.js, run this installer again.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo  OK - Node.js %NODE_VER% found.
echo.

REM ─── Step 2: Check / Install pnpm ────────────────────────────
echo [2/6] Checking pnpm...
pnpm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  pnpm not found. Installing pnpm...
    npm install -g pnpm
    if %errorlevel% neq 0 (
        color 0C
        echo.
        echo  ERROR: Failed to install pnpm.
        echo  Try running this installer as Administrator.
        echo.
        pause
        exit /b 1
    )
    echo  pnpm installed successfully.
) else (
    for /f "tokens=*" %%v in ('pnpm --version') do set PNPM_VER=%%v
    echo  OK - pnpm %PNPM_VER% found.
)
echo.

REM ─── Step 3: Install project dependencies ────────────────────
echo [3/6] Installing project dependencies (this may take a minute)...
call pnpm install
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  ERROR: Failed to install dependencies.
    echo  Check your internet connection and try again.
    echo.
    pause
    exit /b 1
)
echo  OK - Dependencies installed.
echo.

REM ─── Step 4: Set up environment file ─────────────────────────
echo [4/6] Setting up environment variables...
echo.

if exist "artifacts\api-server\.env" (
    echo  .env file already exists. Skipping creation.
    echo  To change settings, edit: artifacts\api-server\.env
) else (
    echo  We need a few details to set up your environment.
    echo.

    set /p DB_URL="  Enter your PostgreSQL connection URL: "
    echo   Example: postgresql://postgres:password@localhost:5432/trading_dashboard
    echo.

    set /p OAI_KEY="  Enter your OpenAI API Key (or press Enter to skip): "
    echo.

    (
        echo DATABASE_URL=%DB_URL%
        echo OPENAI_API_KEY=%OAI_KEY%
        echo PORT=8080
        echo NODE_ENV=development
    ) > artifacts\api-server\.env

    echo  OK - .env file created at artifacts\api-server\.env
)
echo.

REM ─── Step 5: Run database migrations ─────────────────────────
echo [5/6] Running database migrations...
call pnpm --filter @workspace/db run migrate
if %errorlevel% neq 0 (
    color 0E
    echo.
    echo  WARNING: Database migration failed.
    echo  This usually means your DATABASE_URL is incorrect or
    echo  PostgreSQL is not running.
    echo.
    echo  Fix the DATABASE_URL in artifacts\api-server\.env
    echo  Then run:  pnpm --filter @workspace/db run migrate
    echo.
) else (
    echo  OK - Database tables created.
)
echo.

REM ─── Step 6: Done ─────────────────────────────────────────────
echo [6/6] Installation complete!
echo.
echo ============================================================
echo   Setup Summary
echo ============================================================
echo.
echo   Start the app anytime by running:   start.bat
echo   Edit settings at:  artifacts\api-server\.env
echo.
echo ============================================================
echo.
set /p LAUNCH="  Launch the app now? (Y/N): "
if /i "%LAUNCH%"=="Y" (
    start start.bat
)
echo.
pause
