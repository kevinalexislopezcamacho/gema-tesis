#!/bin/bash

# Script para instalar las dependencias del proyecto

echo "==================================="
echo "CodePath - Instalador de Dependencias"
echo "==================================="
echo ""

echo "Instalando dependencias del BACKEND..."
cd backend
npm install
if [ $? -ne 0 ]; then
    echo "Error al instalar dependencias del backend"
    exit 1
fi
echo "Backend instalado correctamente"
echo ""

echo "Creando archivo .env del backend..."
if [ ! -f ".env" ]; then
    cp ".env.example" ".env"
    echo "Archivo .env creado. Revisa backend/.env y actualiza las variables si es necesario"
else
    echo "Archivo .env ya existe"
fi
echo ""

cd ..

echo "Instalando dependencias del FRONTEND..."
cd fronted
npm install
if [ $? -ne 0 ]; then
    echo "Error al instalar dependencias del frontend"
    exit 1
fi
echo "Frontend instalado correctamente"
echo ""

echo "Creando archivo .env.local del frontend..."
if [ ! -f ".env.local" ]; then
    echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > .env.local
    echo "Archivo .env.local creado"
else
    echo "Archivo .env.local ya existe"
fi
echo ""

cd ..

echo "==================================="
echo "¡Instalación completada!"
echo "==================================="
echo ""
echo "Próximos pasos:"
echo "1. Asegurar que MongoDB está corriendo"
echo "2. Abrir dos terminales:"
echo "   - Terminal 1: cd backend && npm run dev"
echo "   - Terminal 2: cd fronted && npm run dev"
echo "3. Acceder a http://localhost:3002"
echo ""
echo "Credenciales demo:"
echo "  Email: carlos@universidad.edu"
echo "  Password: estudiante123"
echo ""
