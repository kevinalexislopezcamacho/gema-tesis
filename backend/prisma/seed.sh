#!/bin/bash
# Ejecutar migraciones de Prisma
echo "Ejecutando migraciones de Prisma..."
npx prisma migrate deploy

echo "Generando cliente de Prisma..."
npx prisma generate

echo "✅ Base de datos lista!"
