param()
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

python -m PyInstaller `
  --name "SIGIR-свод-из-pptx" `
  --onefile `
  --windowed `
  --collect-all tkinterdnd2 `
  --collect-data pptx `
  --noconfirm `
  gui.py

Write-Host ""
Write-Host "Готово: dist\SIGIR-свод-из-pptx.exe"

