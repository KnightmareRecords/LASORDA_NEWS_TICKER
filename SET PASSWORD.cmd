@echo off
title LASORDA Ticker - Set admin password
cd /d "%~dp0"
echo Type the admin password you want (the "Admin key" in the control panel) and press Enter.
echo Nothing shows while you type - that is normal.
echo.
call npx wrangler secret put ADMIN_TOKEN
echo.
echo Done. The new password works right away - no deploy needed.
pause
