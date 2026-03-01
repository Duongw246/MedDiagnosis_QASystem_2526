@echo off
echo Dang dung tat ca cac tien trinh Python va Node.js cu...
taskkill /F /IM python.exe /T >nul 2>&1
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM uvicorn.exe /T >nul 2>&1

echo Da don dep xong. Dang khoi dong lai ung dung...
timeout /t 2 >nul
call run_app.bat
