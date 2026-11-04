@echo off
rem Publishes the ticker with no questions asked and writes everything to deploy-log.txt.
rem Used when Claude deploys remotely; DEPLOY.cmd is the normal one.
cd /d "%~dp0"
echo Deploy started %date% %time% > deploy-log.txt
call npx wrangler whoami >> deploy-log.txt 2>&1 < nul
call npm run db:migrate:remote >> deploy-log.txt 2>&1 < nul
if errorlevel 1 (echo DEPLOY FAILED at database step >> deploy-log.txt & exit /b 1)
call npm run deploy >> deploy-log.txt 2>&1 < nul
if errorlevel 1 (echo DEPLOY FAILED at publish step >> deploy-log.txt & exit /b 1)
echo DEPLOY FINISHED %date% %time% >> deploy-log.txt
