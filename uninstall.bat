@echo off
title NSE/BSE AI Trading Signals - Uninstaller
color 0C
cls

echo ============================================================
echo   NSE/BSE AI Trading Signals - Uninstaller
echo ============================================================
echo.
echo  This will remove:
echo    - All installed node_modules (dependencies)
echo    - The .env environment file
echo.
echo  This will NOT remove:
echo    - Your source code files
echo    - Your database or its data
echo.

set /p CONFIRM="  Are you sure you want to uninstall? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo.
    echo  Uninstall cancelled.
    pause
    exit /b 0
)

echo.
echo [1/3] Removing node_modules...
if exist "node_modules" (
    rmdir /s /q node_modules
    echo  OK - Root node_modules removed.
)
if exist "artifacts\api-server\node_modules" (
    rmdir /s /q artifacts\api-server\node_modules
    echo  OK - API server node_modules removed.
)
if exist "artifacts\market-dashboard\node_modules" (
    rmdir /s /q artifacts\market-dashboard\node_modules
    echo  OK - Frontend node_modules removed.
)
echo.

echo [2/3] Removing environment file...
if exist "artifacts\api-server\.env" (
    set /p DEL_ENV="  Delete artifacts\api-server\.env? (Y/N): "
    if /i "%DEL_ENV%"=="Y" (
        del /f "artifacts\api-server\.env"
        echo  OK - .env file removed.
    ) else (
        echo  Skipped .env file.
    )
) else (
    echo  No .env file found. Skipping.
)
echo.

echo [3/3] Cleaning build artifacts...
if exist "artifacts\api-server\dist" (
    rmdir /s /q artifacts\api-server\dist
    echo  OK - API server build removed.
)
if exist "artifacts\market-dashboard\dist" (
    rmdir /s /q artifacts\market-dashboard\dist
    echo  OK - Frontend build removed.
)
echo.

echo ============================================================
echo   Uninstall complete.
echo   To reinstall, run install.bat again.
echo ============================================================
echo.
pause
