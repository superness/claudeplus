@echo off
title Claude Plus Pipeline System
echo ========================================
echo    Claude Plus Pipeline System Launcher
echo ========================================
echo.

echo [1/3] Starting backend proxy server...
cd /d "%~dp0proxy"
start "Claude Proxy Server" cmd /k "node server.js"

echo [2/3] Starting file server...
cd /d "%~dp0"
start "File Server" cmd /k "python -m http.server 3003"

echo [3/3] Opening pipeline interface...
timeout /t 3 /nobreak >nul
start "" "http://localhost:3003/standalone-pipeline.html"

echo.
echo ✅ Pipeline system started successfully!
echo.
echo 🌐 Access your pipeline at: http://localhost:3003/standalone-pipeline.html
echo 🖥️  Backend server running on: ws://localhost:8081
echo.
echo Press any key to close this launcher...
pause >nul