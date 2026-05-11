@echo off
setlocal

echo.
echo  ============================================================
echo   NSE/BSE AI Trading Terminal — Windows Setup
echo  ============================================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed.
    echo  Please download and install Node.js 20 LTS from:
    echo  https://nodejs.org
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -e "process.stdout.write(process.version)"') do set NODE_VER=%%i
echo  Node.js found: %NODE_VER%

:: Copy .env example if .env doesn't exist
if not exist ".env" (
    echo  Creating .env from template...
    copy ".env.example" ".env" >nul
    echo  [!] Edit .env to add your DATABASE_URL and OPENAI_API_KEY before running.
    echo.
)

:: Install npm dependencies
echo  Installing dependencies (this takes 3-5 minutes on first run)...
echo.
call npm install
if %errorlevel% neq 0 (
    echo  [ERROR] npm install failed.
    pause
    exit /b 1
)

echo.
echo  ============================================================
echo   Setup complete!
echo  ============================================================
echo.
echo  To launch the app:
echo    npm run dev         (build + start in development mode)
echo.
echo  To build a distributable .exe installer:
echo    npm run dist
echo  Output: release\NSE BSE Trading Terminal Setup 1.0.0.exe
echo.
echo  NOTE: Edit .env to configure your database and AI keys.
echo.
pause
