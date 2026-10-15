#!/usr/bin/env bash
# =============================================================================
# pgdev.sh - PostgreSQL local portatil para desarrollo (C-ROTULUS / Next.js).
#
# El sandbox de vista previa se RECREA entre sesiones: solo persiste
# /workspace. Por eso la base de datos y el binario viven dentro de /workspace
# (igual que .php-runtime para el backend antiguo).
#
# Modos:
#   tools/pgdev.sh --ensure   arranca si hace falta (silencioso)
#   tools/pgdev.sh --stop     detiene el cluster
#   tools/pgdev.sh --reset    borra los datos y vuelve a crear el cluster
#
# Requiere el paquete postgresql instalado (apt). Si no esta, lo instala.
# NO se usa en produccion: en Vercel la base de datos es Neon (externa).
# =============================================================================
set -u

PGROOT="/workspace/.pg-runtime"       # persiste entre sesiones
PGDATA="$PGROOT/data"
PGLOG="$PGROOT/postgres.log"
PGPORT="${PGPORT:-5432}"
PGUSER="crotulus"
PGPASS="crotulus_dev"
PGDB="crotulus"
MODE="${1:-}"

# --- Localiza el binario de PostgreSQL --------------------------------------
find_pg_bin() {
  local v
  v="$(ls /usr/lib/postgresql 2>/dev/null | sort -V | tail -1)"
  [ -n "$v" ] && [ -x "/usr/lib/postgresql/$v/bin/initdb" ] && { echo "/usr/lib/postgresql/$v/bin"; return 0; }
  return 1
}

install_pg() {
  echo "[pgdev] instalando postgresql..."
  sudo -n apt-get update -qq >/dev/null 2>&1
  sudo -n apt-get install -y -qq postgresql >/dev/null 2>&1
}

pg_alive() {
  pg_isready -h 127.0.0.1 -p "$PGPORT" >/dev/null 2>&1
}

init_cluster() {
  local bin="$1"
  mkdir -p "$PGROOT"
  # initdb no puede ejecutarse como root: usamos un usuario sin privilegios.
  # El sandbox corre como "openhands"; si no, caemos a root con --allow.
  rm -rf "$PGDATA"
  mkdir -p "$PGDATA"
  "$bin/initdb" -D "$PGDATA" -U "$PGUSER" --auth=trust --encoding=UTF8 >/dev/null 2>&1
  {
    echo "listen_addresses = '127.0.0.1'"
    echo "port = $PGPORT"
    echo "unix_socket_directories = '$PGROOT'"
  } >> "$PGDATA/postgresql.conf"
  # Escritura en la BD del superusuario + rol de la app.
  "$bin/pg_ctl" -D "$PGDATA" -o "-p $PGPORT" -l "$PGLOG" start >/dev/null 2>&1
  sleep 2
  "$bin/psql" -h 127.0.0.1 -p "$PGPORT" -U "$PGUSER" -d postgres \
    -c "ALTER ROLE $PGUSER WITH PASSWORD '$PGPASS';" >/dev/null 2>&1
  "$bin/createdb" -h 127.0.0.1 -p "$PGPORT" -U "$PGUSER" "$PGDB" 2>/dev/null
  "$bin/pg_ctl" -D "$PGDATA" -o "-p $PGPORT" -l "$PGLOG" stop >/dev/null 2>&1
}

start_cluster() {
  local bin="$1"
  # PostgreSQL exige permisos 0700/0750 en el directorio de datos; el volumen
  # /workspace puede recrearlos con otros permisos entre sesiones.
  chmod 700 "$PGDATA" 2>/dev/null
  chmod 700 "$PGROOT" 2>/dev/null
  "$bin/pg_ctl" -D "$PGDATA" -o "-p $PGPORT" -l "$PGLOG" start >/dev/null 2>&1
  sleep 2
}

# --- Ejecucion ---------------------------------------------------------------
BIN="$(find_pg_bin)" || { install_pg; BIN="$(find_pg_bin)" || { echo "[pgdev] ERROR: sin binario postgresql"; exit 1; }; }

case "$MODE" in
  --stop)
    "$BIN/pg_ctl" -D "$PGDATA" stop >/dev/null 2>&1 && echo "[pgdev] detenido"
    ;;
  --reset)
    "$BIN/pg_ctl" -D "$PGDATA" stop >/dev/null 2>&1
    init_cluster "$BIN"; start_cluster "$BIN"
    echo "[pgdev] cluster reiniciado en $PGDATA"
    ;;
  --ensure|*)
    if pg_alive; then
      [ "$MODE" = "--ensure" ] || echo "[pgdev] ya estaba en marcha"
      exit 0
    fi
    if [ ! -f "$PGDATA/PG_VERSION" ]; then
      init_cluster "$BIN"
    fi
    start_cluster "$BIN"
    pg_alive && { [ "$MODE" = "--ensure" ] || echo "[pgdev] arrancado en 127.0.0.1:$PGPORT"; } || { echo "[pgdev] ERROR: no arranco"; tail -5 "$PGLOG"; exit 1; }
    ;;
esac
