@echo off
REM Script para instalar las dependencias del proyecto

echo ===================================
echo CodePath - Instalador de Dependencias
echo ===================================
echo.

echo Instalando dependencias del BACKEND...
cd backend
call npm install
if %ERRORLEVEL% neq 0 (
    echo Error al instalar dependencias del backend
    pause
    exit /b 1
)
echo Backend instalado correctamente
echo.

echo Creando archivo .env del backend...
if not exist ".env" (
    copy ".env.example" ".env"
    echo Archivo .env creado. Revisa backend\.env y actualiza las variables si es necesario
) else (
    echo Archivo .env ya existe
)
echo.

cd ..

echo Instalando dependencias del FRONTEND...
cd fronted
call npm install
if %ERRORLEVEL% neq 0 (
    echo Error al instalar dependencias del frontend
    pause
    exit /b 1
)
echo Frontend instalado correctamente
echo.

echo Creando archivo .env.local del frontend...
if not exist ".env.local" (
    (
        echo NEXT_PUBLIC_API_URL=http://localhost:8000/api
    ) > .env.local
    echo Archivo .env.local creado
) else (
    echo Archivo .env.local ya existe
)
echo.

cd ..

echo ===================================
echo Instalación completada!
echo ===================================
echo.
echo Próximos pasos:
echo 1. Asegurar que MongoDB está corriendo
echo 2. Abrir dos terminales:
echo    - Terminal 1: cd backend && npm run dev
echo    - Terminal 2: cd fronted && npm run dev
echo 3. Acceder a http://localhost:3002
echo.
echo Credenciales demo:
echo   Email: carlos@universidad.edu
echo   Password: estudiante123
echo.
pause
