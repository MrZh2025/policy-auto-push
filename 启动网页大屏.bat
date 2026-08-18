@echo off
chcp 65001 >nul
title 医药产业政策大屏

cd /d "%~dp0"
echo ========================================================
echo Starting Medical Policy Web Dashboard...
echo Open your browser at http://127.0.0.1:8080
echo ========================================================
echo.

python web_server.py

pause
