#!/usr/bin/env bash
# Sube el código local al servidor y reconstruye/reinicia los contenedores.
# Uso: bash deploy.sh
set -e

SERVER="tesis-vm"
REMOTE_DIR="/home/kevin/tesis"

echo "== Subiendo código a $SERVER =="
tar czf - \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='dist' \
  --exclude='__pycache__' \
  --exclude='.git' \
  --exclude='*.tsbuildinfo' \
  --exclude='backend/prisma/dev.db' \
  --exclude='backend/prisma/dev.db-journal' \
  --exclude='backend/.env.prod' \
  --exclude='video_service/.env.prod' \
  --exclude='video_service/output' \
  . | ssh "$SERVER" "mkdir -p $REMOTE_DIR && tar xzf - -C $REMOTE_DIR"

echo "== Limpiando en el servidor archivos que ya no existen en local =="
# tar extrae de forma aditiva y nunca borra — sin este paso, un archivo
# eliminado en local (p.ej. una ruta de Next.js) queda huérfano para
# siempre en el servidor y se vuelve a compilar en cada build.
LOCAL_MANIFEST="$(mktemp)"
find . \( -name node_modules -o -name .next -o -name dist -o -name __pycache__ -o -name .git \) -prune -o \
  -type f \
  ! -name '*.tsbuildinfo' \
  ! -path './backend/prisma/dev.db' \
  ! -path './backend/prisma/dev.db-journal' \
  ! -path './backend/.env.prod' \
  ! -path './video_service/.env.prod' \
  ! -path './video_service/output/*' \
  -print | sed 's|^\./||' | sort > "$LOCAL_MANIFEST"

LOCAL_COUNT=$(wc -l < "$LOCAL_MANIFEST")
if [ "$LOCAL_COUNT" -lt 50 ]; then
  echo "!! Abortando limpieza remota: el manifiesto local solo tiene $LOCAL_COUNT archivos (se esperaban muchos más)."
  echo "!! Esto huele a que el script no corrió desde la raíz del repo. No se borra nada en el servidor."
  rm -f "$LOCAL_MANIFEST"
else
  scp -q "$LOCAL_MANIFEST" "$SERVER:/tmp/tesis_local_manifest.txt"

  ssh "$SERVER" REMOTE_DIR="$REMOTE_DIR" bash -s <<'REMOTE_SCRIPT'
set -e
cd "$REMOTE_DIR"
find . \( -name node_modules -o -name .next -o -name dist -o -name __pycache__ -o -name .git \) -prune -o \
  -type f \
  ! -name '*.tsbuildinfo' \
  ! -path './backend/prisma/dev.db' \
  ! -path './backend/prisma/dev.db-journal' \
  ! -path './backend/.env.prod' \
  ! -path './video_service/.env.prod' \
  ! -path './video_service/output/*' \
  -print | sed 's|^\./||' | sort > /tmp/tesis_remote_manifest.txt

comm -23 /tmp/tesis_remote_manifest.txt /tmp/tesis_local_manifest.txt > /tmp/tesis_orphans.txt

if [ -s /tmp/tesis_orphans.txt ]; then
  echo "Borrando $(wc -l < /tmp/tesis_orphans.txt) archivo(s) huérfano(s):"
  sed 's/^/  - /' /tmp/tesis_orphans.txt
  while IFS= read -r f; do rm -f -- "$f"; done < /tmp/tesis_orphans.txt
  find . \( -name node_modules -o -name .git \) -prune -o -type d -empty -print > /tmp/tesis_empty_dirs.txt
  while IFS= read -r d; do rmdir -- "$d" 2>/dev/null || true; done < /tmp/tesis_empty_dirs.txt
  rm -f /tmp/tesis_empty_dirs.txt
else
  echo "Nada que limpiar."
fi
rm -f /tmp/tesis_local_manifest.txt /tmp/tesis_remote_manifest.txt /tmp/tesis_orphans.txt
REMOTE_SCRIPT

  rm -f "$LOCAL_MANIFEST"
fi

echo "== Reconstruyendo y reiniciando contenedores =="
ssh "$SERVER" "cd $REMOTE_DIR && docker compose -f docker-compose.prod.yml up -d --build"

echo "== Listo: http://104.225.223.220:9074 =="
