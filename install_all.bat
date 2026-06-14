@echo off
setlocal
cd /d "%~dp0"

REM UTF-8 output/input for Vietnamese messages and Python logs
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
chcp 65001 >nul

echo ==========================================
echo CAI DAT DU AN X-RAY APP
echo ==========================================

echo.
echo [1/2] CAI DAT BACKEND (PYTHON)...
echo ------------------------------------------

if not exist "backend" (
    echo Loi: Khong tim thay thu muc 'backend'
    pause
    exit /b 1
)

cd backend

REM Kiem tra Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Loi: Khong tim thay Python. Vui long cai dat Python va them vao PATH.
    pause
    exit /b 1
)

REM Kiem tra pip
python -m pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Loi: Pip khong kha dung. Vui long cai dat lai Python (co kem pip).
    pause
    exit /b 1
)

REM Tao venv
if not exist "venv" (
    echo Dang tao moi truong ao (venv)...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo Loi: Khong the tao venv.
        pause
        exit /b 1
    )
) else (
    echo Venv da ton tai.
)

REM Kich hoat venv va cai dat
echo Dang kich hoat venv va cai dat thu vien...
call venv\Scripts\activate
if %errorlevel% neq 0 (
    echo Loi: Khong the kich hoat venv.
    pause
    exit /b 1
)

if exist "requirements.txt" (
    python -m pip install --upgrade pip setuptools wheel
    if %errorlevel% neq 0 (
        echo Loi: Khong the cap nhat pip/setuptools/wheel.
        pause
        exit /b 1
    )

    python -m pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo Loi: Cai dat thu vien Python that bai.
        pause
        exit /b 1
    )
) else (
    echo Loi: Khong tim thay file requirements.txt
    pause
    exit /b 1
)

echo Backend OK.

echo.
echo [2/2] CAI DAT FRONTEND (NODE.JS)...
echo ------------------------------------------

cd ..\frontend

if not exist "package.json" (
    echo Loi: Khong tim thay file package.json trong thu muc frontend
    pause
    exit /b 1
)

REM Kiem tra Node
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Loi: Khong tim thay Node.js. Vui long cai dat Node.js.
    pause
    exit /b 1
)

npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Loi: Khong tim thay npm. Vui long cai dat lai Node.js (co npm).
    pause
    exit /b 1
)

if exist "package-lock.json" (
    echo Dang cai dat node modules bang npm ci...
    call npm ci
) else (
    echo Dang cai dat node modules bang npm install...
    call npm install
)

if %errorlevel% neq 0 (
    echo Loi: Cai dat node modules that bai.
    pause
    exit /b 1
)

echo Frontend OK.

echo.
echo ==========================================
echo CAI DAT HOAN TAT!
echo ==========================================
echo.
echo Ban co the chay file run_app.bat de khoi dong du an.
pause
