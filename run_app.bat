@echo off
cd /d "%~dp0"

rem Force UTF-8 for Python output (prevents UnicodeEncodeError with Vietnamese)
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8

echo ==========================================
echo KHOI DONG X-RAY APP
echo ==========================================

rem Auto-pick free ports (avoids getting stuck when a previous instance is still listening)
set "BACKEND_PORT=8000"
:_find_backend_port
set "PID_IN_USE="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%BACKEND_PORT%" ^| findstr /i "LISTENING"') do set "PID_IN_USE=%%a"
if defined PID_IN_USE (
	set /a BACKEND_PORT+=1
	if %BACKEND_PORT% GTR 8010 (
		echo(
		echo [LOI] Khong tim thay port trong khoang 8000-8010 cho Backend.
		echo(
		pause
		exit /b 1
	)
	goto :_find_backend_port
)

set "FRONTEND_PORT=3000"
:_find_frontend_port
set "PID_IN_USE="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%FRONTEND_PORT%" ^| findstr /i "LISTENING"') do set "PID_IN_USE=%%a"
if defined PID_IN_USE (
	set /a FRONTEND_PORT+=1
	if %FRONTEND_PORT% GTR 3010 (
		echo(
		echo [LOI] Khong tim thay port trong khoang 3000-3010 cho Frontend.
		echo(
		pause
		exit /b 1
	)
	goto :_find_frontend_port
)

echo(
echo Dang khoi dong Backend (Port %BACKEND_PORT%)...
start "X-Ray Backend" cmd /k "set PYTHONUTF8=1 & set PYTHONIOENCODING=utf-8 & chcp 65001 >nul & pushd ""%~dp0backend"" & call venv\Scripts\activate.bat & python -X utf8 -m uvicorn main:app --reload --host 0.0.0.0 --port %BACKEND_PORT%"

echo(
echo Dang khoi dong Frontend (Port %FRONTEND_PORT%)...
if not exist "frontend\node_modules" (
	echo(
	echo [CANH BAO] Chua co frontend\node_modules. Hay chay install_all.bat hoac vao frontend va chay npm install.
)
start "X-Ray Frontend" cmd /k "pushd ""%~dp0frontend"" & set ""NEXT_PUBLIC_BACKEND_URL=http://localhost:%BACKEND_PORT%"" & npm run dev -- --port %FRONTEND_PORT%"

echo(
echo ==========================================
echo DA KHOI DONG!
echo Backend: http://localhost:%BACKEND_PORT%
echo Frontend: http://localhost:%FRONTEND_PORT%
echo ==========================================
echo(
echo Hay doi mot chut de server khoi dong xong...
pause
