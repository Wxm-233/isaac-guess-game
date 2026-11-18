@echo off
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel% equ 0 (
  node server.mjs
) else (
  wsl --cd "%~dp0." bash ./start-demo.sh
)
pause
