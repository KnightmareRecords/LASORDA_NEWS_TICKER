@echo off
title LASORDA Ticker - Publish update
cd /d "%~dp0"
echo Updating the database (if it asks "continue?", type y and press Enter)...
call npm run db:migrate:remote
if errorlevel 1 (echo. & echo Database update failed - nothing was published. Send the text above to Claude. & pause & exit /b 1)
echo.
echo Publishing...
call npm run deploy
echo.
echo Done. Changes are live in about a minute.
pause
