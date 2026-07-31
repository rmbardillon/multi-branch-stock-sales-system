@echo off
title Dev Server - Backend + Frontend

echo Starting backend and frontend...
echo.

start "Backend" cmd /k "cd /d %~dp0backend && npm run dev"
start "Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Both servers launched in separate windows.
echo Close this window or press any key to exit.
pause >nul
