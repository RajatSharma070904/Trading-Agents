@echo off
chcp 65001 >nul
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
title AlphaSwarm AI API Backend
cd /d "%~dp0"
echo Starting AlphaSwarm AI Python Backend on http://127.0.0.1:8000 ...
call .venv\Scripts\activate.bat
python -m uvicorn server:app --host 127.0.0.1 --port 8000
pause
