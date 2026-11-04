@echo off
title LASORDA Ticker - Publish update
cd /d "%~dp0"
call npm run deploy
echo.
echo Done. Changes are live in about a minute.
pause
