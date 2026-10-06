# Собирает standalone .exe (один файл, без установки Python/Office у пользователя).
# Запуск: из этой папки -> powershell -File build.ps1
# Результат: dist\SIGIR-выравнивание-слайдов.exe

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

python -m PyInstaller `
  --name "SIGIR-выравнивание-слайдов" `
  --onefile `
  --windowed `
  --add-data "референс общей презентации.pptx;." `
  --collect-all tkinterdnd2 `
  --collect-data pptx `
  --noconfirm `
  gui.py

Write-Host ""
Write-Host "Готово: dist\SIGIR-выравнивание-слайдов.exe"

