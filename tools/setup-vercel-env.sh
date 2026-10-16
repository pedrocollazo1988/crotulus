#!/usr/bin/env bash
# =============================================================================
# setup-vercel-env.sh - Sube de una vez las variables de entorno a Vercel.
#
# Lee los valores de  deploy/vercel.env  (copia la plantilla vercel.env.example)
# y los sube con "vercel env add" a los entornos Production y Preview.
#
# Uso:
#   bash tools/setup-vercel-env.sh --dry-run     # muestra QUE haria, sin tocar nada
#   bash tools/setup-vercel-env.sh               # sube (pide confirmacion)
#   bash tools/setup-vercel-env.sh --yes         # sin confirmacion
#   bash tools/setup-vercel-env.sh --only prod   # solo Production
#
# Requisitos: Node (npx). El script usa "npx vercel" si no hay "vercel" instalado.
#
# Notas de fiabilidad (bugs conocidos del CLI de Vercel):
#   - "vercel env add NAME preview" exige rama explicita en algunas versiones.
#     Aqui se pasa SIEMPRE la rama (por defecto la actual) para evitarlo.
#   - Algunas versiones reportan exito pero guardan cadena vacia. Por eso, tras
#     subir, el script comprueba cada valor con "vercel env pull" y avisa.
# =============================================================================
cd "$(dirname "$0")/.." || exit 1

ENV_FILE="${ENV_FILE:-deploy/vercel.env}"
TMP_ENV="$(mktemp -t vercel-pull.XXXXXX)"
BRANCH="${BRANCH:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)}"
ASSUME_YES=0
DRY_RUN=0
ONLY=""

while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y) ASSUME_YES=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --only) shift; ONLY="${1:-}" ;;
    --branch) shift; BRANCH="${1:-}" ;;
    *) echo "Opcion desconocida: $1"; exit 2 ;;
  esac
  shift
done

# --- CLI de Vercel ------------------------------------------------------------
if command -v vercel >/dev/null 2>&1; then
  VC=(vercel)
elif command -v npx >/dev/null 2>&1; then
  VC=(npx --yes vercel)
else
  echo "ERROR: hace falta Node/npx (o 'npm i -g vercel') para usar este script."
  exit 1
fi

# Comprobacion de sesion: sin ella el CLI abre un login interactivo y el script
# se queda colgado. "whoami" responde siempre (incluso sin sesion). Se hace
# despues del resumen/dry-run, para poder previsualizar sin haber entrado.
require_login() {
  if "${VC[@]}" whoami --non-interactive 2>&1 | grep -q "Logged out"; then
    echo "ERROR: no has iniciado sesion en Vercel."
    echo "Ejecuta primero:  npx vercel login"
    exit 1
  fi
}

# --- Plantilla ----------------------------------------------------------------
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: no encuentro $ENV_FILE"
  echo "Crea uno a partir de la plantilla:"
  echo "    cp deploy/vercel.env.example deploy/vercel.env"
  exit 1
fi

# Carga el archivo sin ejecutar comandos (solo lineas CLAVE="valor").
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

# APP_KEY: si viene vacia, se genera y se escribe de vuelta en el archivo.
if [ -z "${APP_KEY:-}" ]; then
  APP_KEY="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  echo "[env] APP_KEY vacia: generada una nueva."
  if grep -q '^APP_KEY=' "$ENV_FILE"; then
    # sed portable (GNU/BSD)
    sed -i.bak "s|^APP_KEY=.*|APP_KEY=\"$APP_KEY\"|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
  else
    printf '\nAPP_KEY="%s"\n' "$APP_KEY" >>"$ENV_FILE"
  fi
  echo "[env] Guardada en $ENV_FILE (no se versiona)."
fi

# Nombre -> valor. Solo se suben las que tienen valor.
VARS=(
  "APP_SITE_URL:${APP_SITE_URL:-}"
  "APP_KEY:${APP_KEY:-}"
  "TZ:${TZ:-}"
  "ADMIN_EMAIL:${ADMIN_EMAIL:-}"
  "ADMIN_PASSWORD:${ADMIN_PASSWORD:-}"
  "ADMIN_RESET_PASSWORD:${ADMIN_RESET_PASSWORD:-}"
  "ADMIN_NAME:${ADMIN_NAME:-}"
  "MAIL_SMTP_USER:${MAIL_SMTP_USER:-}"
  "MAIL_SMTP_PASS:${MAIL_SMTP_PASS:-}"
  "MAIL_TO:${MAIL_TO:-}"
  "GOOGLE_CLIENT_ID:${GOOGLE_CLIENT_ID:-}"
  "GOOGLE_CLIENT_SECRET:${GOOGLE_CLIENT_SECRET:-}"
  "GOOGLE_PLACES_API_KEY:${GOOGLE_PLACES_API_KEY:-}"
  "DATABASE_URL:${DATABASE_URL:-}"
  "DATABASE_URL_UNPOOLED:${DATABASE_URL_UNPOOLED:-}"
)

# APP_SITE_URL puede tener un valor distinto en Preview.
PREVIEW_OVERRIDE_SITE="${APP_SITE_URL_PREVIEW:-}"

# Entornos a tocar.
TARGETS=(production preview)
[ "$ONLY" = "prod" ] && TARGETS=(production)
[ "$ONLY" = "preview" ] && TARGETS=(preview)

mask() {
  # Oculta el valor dejando pistas: largo y 4 ultimos caracteres.
  local v="$1"
  local n=${#v}
  [ "$n" -le 4 ] && { printf '****'; return; }
  printf '%s…%s (%d car.)' "${v:0:3}" "${v: -4}" "$n"
}

echo
echo "Proyecto : $(basename "$PWD")   Rama: $BRANCH"
echo "Archivo  : $ENV_FILE"
echo "Entornos : ${TARGETS[*]}"
echo

# --- Resumen previo -----------------------------------------------------------
COUNT=0
for item in "${VARS[@]}"; do
  name="${item%%:*}"; value="${item#*:}"
  [ -z "$value" ] && continue
  COUNT=$((COUNT + 1))
  echo "  $name = $(mask "$value")"
done
[ -n "$PREVIEW_OVERRIDE_SITE" ] && echo "  (Preview: APP_SITE_URL = $PREVIEW_OVERRIDE_SITE)"
echo
echo "Total: $COUNT variables x ${#TARGETS[@]} entorno(s)."
echo

if [ "$DRY_RUN" = "1" ]; then
  echo "[dry-run] No se ha tocado nada. Quita --dry-run para subirlas."
  rm -f "$TMP_ENV"; exit 0
fi

require_login

if [ "$ASSUME_YES" != "1" ]; then
  read -r -p "¿Subir estas variables a Vercel? [s/N] " ans
  case "$ans" in [sS]*|[yY]*) ;; *) echo "Cancelado."; rm -f "$TMP_ENV"; exit 0 ;; esac
fi

# --- Subida -------------------------------------------------------------------
# Se usa "--git-branch" (CLI >= 50) y, si falla, la rama posicional (CLI antiguo).
upload() {
  local name="$1" value="$2" target="$3" branch="$4"

  if [ "$target" = "preview" ] && [ -n "$branch" ]; then
    if printf '%s' "$value" | "${VC[@]}" env add "$name" preview --git-branch "$branch" --force >/dev/null 2>&1 \
    || printf '%s' "$value" | "${VC[@]}" env add "$name" preview "$branch" --force >/dev/null 2>&1; then
      echo "  ok   $name  -> preview ($branch)"
      return 0
    fi
  else
    if printf '%s' "$value" | "${VC[@]}" env add "$name" "$target" --force >/dev/null 2>&1; then
      echo "  ok   $name  -> $target"
      return 0
    fi
  fi

  echo "  FALLO $name -> $target${branch:+ ($branch)}"
  return 1
}

FAILS=0
for target in "${TARGETS[@]}"; do
  echo "[$target]"
  for item in "${VARS[@]}"; do
    name="${item%%:*}"; value="${item#*:}"
    [ -z "$value" ] && continue
    # En Preview, APP_SITE_URL puede ser distinto.
    if [ "$target" = "preview" ] && [ "$name" = "APP_SITE_URL" ] && [ -n "$PREVIEW_OVERRIDE_SITE" ]; then
      value="$PREVIEW_OVERRIDE_SITE"
    fi
    upload "$name" "$value" "$target" "$BRANCH" || FAILS=$((FAILS + 1))
  done
  echo
done

# --- Verificacion -------------------------------------------------------------
# Algunas versiones del CLI dicen "ok" pero guardan cadena vacia. Se comprueba.
echo "[verificacion] Descargando las variables de Production para revisarlas..."
if "${VC[@]}" env pull "$TMP_ENV" --environment=production --yes >/dev/null 2>&1; then
  for item in "${VARS[@]}"; do
    name="${item%%:*}"; value="${item#*:}"
    [ -z "$value" ] && continue
    pulled="$(grep -E "^${name}=" "$TMP_ENV" | head -1 | cut -d= -f2- | sed -E 's/^"//; s/"$//')"
    if [ -z "$pulled" ]; then
      echo "  AVISO: $name quedo VACIA en Vercel (bug conocido del CLI)."
      echo "         Anadela a mano en el panel: Settings > Environment Variables."
      FAILS=$((FAILS + 1))
    else
      echo "  ok   $name"
    fi
  done
else
  echo "  (no se pudo verificar automaticamente; revisa Settings > Environment Variables)"
fi
rm -f "$TMP_ENV"

echo
if [ "$FAILS" -gt 0 ]; then
  echo "Terminado con $FAILS problema(s). Revisa los AVISO de arriba."
else
  echo "Todo subido y verificado."
fi
echo
echo "SIGUIENTE PASO: las variables no se aplican a despliegues ya hechos."
echo "  - Redeploy en el panel de Vercel (Deployments > ... > Redeploy), o"
echo "  - un push a la rama, que dispara un despliegue nuevo."
echo
echo "Y despues, para crear las tablas en Neon (desde tu maquina):"
echo "    bash tools/setup-neon-db.sh --dry-run   # comprueba la conexion"
echo "    bash tools/setup-neon-db.sh             # migra + siembra"
