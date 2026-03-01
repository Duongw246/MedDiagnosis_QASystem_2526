@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "ROOT=%~dp0"

set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
chcp 65001 >nul

echo ==========================================
echo CAI DAT DU AN X-RAY APP
echo ==========================================

if not exist "%ROOT%backend" (
    echo Loi: Khong tim thay thu muc backend.
    pause
    exit /b 1
)

if not exist "%ROOT%frontend" (
    echo Loi: Khong tim thay thu muc frontend.
    pause
    exit /b 1
)

echo.
echo [1/2] CAI DAT BACKEND (PYTHON)...
echo ------------------------------------------
call :setup_backend
if %errorlevel% neq 0 (
    pause
    exit /b 1
)

echo.
echo [2/2] CAI DAT FRONTEND (NODE.JS)...
echo ------------------------------------------
call :setup_frontend
if %errorlevel% neq 0 (
    pause
    exit /b 1
)

echo.
echo ==========================================
echo CAI DAT HOAN TAT!
echo ==========================================
echo Ban co the chay file run_app.bat de khoi dong du an.
pause
exit /b 0

:setup_backend
cd /d "%ROOT%backend"

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Loi: Khong tim thay Python. Vui long cai dat Python va them vao PATH.
    exit /b 1
)

python -m pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Loi: Pip khong kha dung. Vui long cai dat lai Python (co kem pip).
    exit /b 1
)

if not exist "venv" (
    echo Dang tao moi truong ao backend\venv...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo Loi: Khong the tao backend\venv.
        exit /b 1
    )
) else (
    echo Tim thay backend\venv.
)

echo Dang kich hoat backend\venv...
call venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo Loi: Khong the kich hoat backend\venv.
    exit /b 1
)

if not exist "requirements.txt" (
    echo Loi: Khong tim thay backend\requirements.txt
    exit /b 1
)

echo Dang cap nhat pip/setuptools/wheel...
python -m pip install --upgrade pip setuptools wheel
if %errorlevel% neq 0 (
    echo Loi: Khong the cap nhat pip/setuptools/wheel.
    exit /b 1
)

echo Dang cai dat thu vien backend...
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo Loi: Cai dat thu vien Python that bai.
    exit /b 1
)

if not exist ".env" (
    if exist ".env.example" (
        copy /y ".env.example" ".env" >nul
        echo Da tao backend\.env tu backend\.env.example
    ) else (
        > ".env" echo GEMINI_API_KEY=
        >> ".env" echo PINECONE_API_KEY=
        >> ".env" echo PINECONE_INDEX_NAME=diseases
        echo Da tao backend\.env mau. Hay dien API key truoc khi chat.
    )
) else (
    echo Tim thay backend\.env.
)

call deactivate >nul 2>&1
echo Backend OK.
exit /b 0

:setup_frontend
cd /d "%ROOT%frontend"

if not exist "package.json" (
    echo Loi: Khong tim thay frontend\package.json
    exit /b 1
)

node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Loi: Khong tim thay Node.js. Vui long cai dat Node.js.
    exit /b 1
)

npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Loi: Khong tim thay npm. Vui long cai dat lai Node.js (co npm).
    exit /b 1
)

if exist "package-lock.json" (
    echo Dang cai dat frontend dependencies bang npm ci...
    call npm ci
) else (
    echo Dang cai dat frontend dependencies bang npm install...
    call npm install
)

if %errorlevel% neq 0 (
    echo Loi: Cai dat node modules that bai.
    exit /b 1
)

if not exist ".env.local" (
    > ".env.local" echo NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
    echo Da tao frontend\.env.local
) else (
    echo Tim thay frontend\.env.local.
)

echo Frontend OK.
exit /b 0
