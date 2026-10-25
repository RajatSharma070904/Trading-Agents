@echo off
title Launch AlphaSwarm AI FullStack
cd /d "%~dp0"

echo [1/3] Starting AlphaSwarm Python FastAPI Backend on port 8000...
start "AlphaSwarm AI Backend (Port 8000)" cmd /c "start_backend.bat"

echo [2/3] Starting AlphaSwarm 3D Frontend on port 3000...
start "AlphaSwarm AI Frontend (Port 3000)" cmd /c "start_frontend.bat"

echo [3/3] Waiting 4 seconds for servers to initialize...
timeout /t 4 /nobreak >nul

echo Opening browser at http://localhost:3000 ...
start http://localhost:3000

echo All services launched!
