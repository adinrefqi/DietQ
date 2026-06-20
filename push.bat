@echo off
REM ============================================================
REM  push.bat  Sinkronkan DietQ Web ke GitHub
REM  Tinggal double-click file ini untuk upload semua perubahan.
REM ============================================================
cd /d "%~dp0"

echo.
echo === DietQ : push ke GitHub ===
echo.

REM Pastikan remote 'origin' ada (sekali saja)
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo Menambahkan remote origin...
    git remote add origin https://github.com/adinrefqi/DietQ.git
)

REM Pastikan branch bernama main
git branch -M main

REM Stage semua perubahan (file ter-ignore seperti .env.local TIDAK ikut)
git add -A

REM Commit. Pakai pesan dari argumen kalau ada, kalau tidak pakai default.
set "MSG=%~1"
if "%MSG%"=="" set "MSG=Update DietQ web"
git commit -m "%MSG%"
if errorlevel 1 echo (Tidak ada perubahan baru untuk di-commit, lanjut push...)

REM Push. Pertama kali akan muncul popup login GitHub di browser.
git push -u origin main

echo.
echo === Selesai. Cek: https://github.com/adinrefqi/DietQ ===
echo.
pause
