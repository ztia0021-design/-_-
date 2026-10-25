@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js is required. Install Node.js 24 LTS first.
 pause
 exit /b 1
)
if not exist node_modules (
 call npm ci
 if errorlevel 1 (
  pause
  exit /b 1
 )
)
if not exist dist\server\index.js (
 call npm run build
 if errorlevel 1 (
  pause
  exit /b 1
 )
)
echo.
echo Lens: http://127.0.0.1:3000
echo Keep this window open. Press Ctrl+C to stop.
echo.
call npm start
pause
