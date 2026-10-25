@echo off
chcp 65001 >nul
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
title AlphaSwarm AI - Autonomous Quantitative Stock Agent
cd /d "%~dp0"
echo Activating Virtual Environment...
call .venv\Scripts\activate.bat
echo Starting Stock Analysis...
python analyze.py
pause
