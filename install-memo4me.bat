@echo off
setlocal

set ROOT_DIR=%~dp0

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required but was not found.
  pause
  exit /b 1
)

node "%ROOT_DIR%scripts\install-app.mjs"
pause
