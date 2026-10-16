#!/usr/bin/env bash
# =============================================================================
# setup-neon-db.sh - Prepara la base de datos de Neon (tablas + datos) desde
#                    tu maquina, usando las variables del proyecto de Vercel.
#
# Hace, en orden:
#   1. Descarga las variables de entorno de Vercel a un archivo TEMPORAL.
#   2. Aplica las migraciones de Prisma (crea las tablas).
#   3. Siembra el contenido de ejemplo (solo en tablas vacias).
#   4. (Opcional) Importa los datos del SQLite antiguo.
#
# Uso:
#   bash tools/setup-neon-db.sh --dry-run     # solo comprueba, no escribe nada
#   bash tools/setup-neon-db.sh               # migra + siembra
#   bash tools/setup-neon-db.sh --sqlite legacy/app/data/c-rotulus.sqlite
#   bash tools/setup-neon-db.sh --env production   # entorno de Vercel (def.)
#
# IMPORTANTE (por que no se usa "vercel env pull .env.local"):
#   El CLI de Prisma lee .env, NO .env.local. Si se vuelca ahi, "prisma migrate
#   deploy" falla con P1012 "Environment variable not found: DIRECT_URL".
#   Este script vuelca a un archivo temporal y exporta las variables en la
#   sesion, de modo que no toca tu .env local ni deja secretos en el disco.
#
# Requisitos: Node/npx y haber hecho "npx vercel login" y "vercel link".
# =============================================================================
cd "$(dirname "$0")/.." || exit 1

ENVIRONMENT="${ENVIRONMENT:-production}"
SQLITE_FILE=""
DRY_RUN=0
SKIP_SEED=0

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --env) shift; ENVIRONMENT="${1:-production}" ;;
    --sqlite) shift; SQLITE_FILE="${1:-}" ;;
    --no-seed) SKIP_SEED=1 ;;
    *) echo "Opcion desconocida: $1"; exit 2 ;;
  esac
  shift
done

if command -v vercel >/dev/null 2>&1; then
  VC=(vercel)
elif command -v npx >/dev/null 2>&1; then
  VC=(npx --yes vercel)
else
  echo "ERROR: hace falta Node/npx (o 'npm i -g vercel')."
  exit 1
fi

if "${VC[@]}" whoami --non-interactive 2>&1 | grep -q "Logged out"; then
  echo "ERROR: no has iniciado sesion en Vercel. Ejecuta:  npx vercel login"
  exit 1
fi

PULL_FILE="$(mktemp -t neon-env.XXXXXX)"
cleanup() { rm -f "$PULL_FILE"; }
trap cleanup EXIT

echo "[1/4] Descargando variables de Vercel (entorno: $ENVIRONMENT)..."
if ! "${VC[@]}" env pull "$PULL_FILE" --environment="$ENVIRONMENT" --yes >/dev/null 2>&1; then
  echo "ERROR: no se pudieron descargar las variables."
  echo "Comprueba que el proyecto esta enlazado:  npx vercel link"
  exit 1
fi

# Exporta las variables a la sesion (asi las ven Prisma y el envoltorio).
set -a
# shellcheck disable=SC1090
. "$PULL_FILE"
set +a

# El envoltorio scripts/prisma.mjs rellena DIRECT_URL desde DATABASE_URL_UNPOOLED.
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: el proyecto no tiene DATABASE_URL."
  echo "Instala la integracion de Neon:  Vercel > Storage > Create Database > Neon"
  exit 1
fi

mask() { printf '%s…%s' "${1:0:14}" "${1: -12}"; }
echo "      DATABASE_URL = $(mask "$DATABASE_URL")"
if [ -n "${DATABASE_URL_UNPOOLED:-}" ]; then
  echo "      DATABASE_URL_UNPOOLED = presente (lo usan las migraciones)"
else
  echo "      (sin DATABASE_URL_UNPOOLED; se usara DATABASE_URL para migrar)"
fi

if [ "$DRY_RUN" = "1" ]; then
  echo
  echo "[dry-run] Conexion correcta. Quita --dry-run para crear las tablas."
  echo "          Estado actual de las migraciones:"
  npm run --silent db:status 2>&1 | tail -5
  exit 0
fi

echo
echo "[2/4] Aplicando migraciones (crea las tablas)..."
npm run --silent db:deploy || { echo "ERROR: fallaron las migraciones."; exit 1; }

if [ "$SKIP_SEED" = "1" ]; then
  echo "[3/4] Semilla omitida (--no-seed)."
else
  echo
  echo "[3/4] Sembrando contenido (solo en tablas vacias)..."
  npm run --silent db:seed || echo "AVISO: la semilla fallo (las tablas ya existen)."
fi

if [ -n "$SQLITE_FILE" ]; then
  echo
  echo "[3b] Importando el SQLite antiguo: $SQLITE_FILE"
  if [ -f "$SQLITE_FILE" ]; then
    npm run --silent db:migrate-sqlite -- "$SQLITE_FILE" || echo "AVISO: la importacion fallo."
  else
    echo "AVISO: no encuentro $SQLITE_FILE (se omite)."
  fi
fi

echo
echo "[4/4] Comprobacion final..."
COUNT="$(node -e '
const {PrismaClient}=require("@prisma/client");
const p=new PrismaClient();
Promise.all([p.setting.count(),p.user.count(),p.contentItem.count()])
 .then(([s,u,c])=>{console.log(`${s} ajustes, ${u} usuarios, ${c} contenidos`);return p.$disconnect();})
 .catch(e=>{console.error("ERROR:",String(e).split("\n")[0]);process.exit(1);});
' 2>&1 | tail -1)"

echo "      $COUNT"

echo
echo "Listo. La base de Neon ya tiene el esquema aplicado."
echo
echo "SIGUIENTE PASO: el primer administrador se crea desde la web."
echo "  Abre  https://<tu-dominio>/admin/register  y registrate:"
echo "  el PRIMER usuario registrado se convierte en admin."
