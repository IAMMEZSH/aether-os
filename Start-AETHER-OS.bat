@echo off
cd /d "%~dp0"
where python >NUL 2>&1
if errorlevel 1 (
  echo Python 3.8+ is required. Install Python and run this file again.
  echo You can also open index.html directly to preview the UI.
  pause
  exit /b 1
)
echo Starting AETHER OS local bridge...
echo Windows provides the static UI; real Linux commands require Termux or iSH.
start "AETHER OS Bridge" cmd /k "python bridge\server.py"
timeout /t 2 /nobreak >NUL
start "" "http://127.0.0.1:8787/"
exit /b 0
