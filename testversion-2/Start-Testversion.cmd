@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Bitte zuerst Node.js 24 LTS installieren.
  pause
  exit /b 1
)
if not exist runtime\node_modules\ws\index.js (
  call npm ci --prefix runtime --no-audit --no-fund
  if errorlevel 1 exit /b 1
)
if not exist assets\game\tom-correct-rig.glb (
  node fetch-assets.cjs
  if errorlevel 1 exit /b 1
)
if not defined PORT set PORT=4175
echo Testversion: http://localhost:%PORT%/
node server.cjs
pause
