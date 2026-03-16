$pids = (Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique
foreach ($p in $pids) {
    Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    Write-Host "Killed PID $p"
}
Start-Sleep 1

# Lancer uvicorn
Set-Location "C:\Users\kcodjo\oraux-plateforme\backend"
& "..\venv\Scripts\uvicorn" app.main:app --reload
