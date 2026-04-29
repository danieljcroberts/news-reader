@echo off
echo Stopping any existing News Reader process...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq News Reader" >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
echo Starting News Reader...
echo Open http://localhost:3000 in your browser (or phone browser on same network)
echo.
node server.js
pause
