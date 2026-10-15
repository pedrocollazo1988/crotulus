#!/usr/bin/env bash
# =============================================================================
# serve.sh - Mantiene vivo el servidor PHP de vista previa (solo desarrollo).
#
# Modos:
#   tools/serve.sh            -> arranca si hace falta y sale (idempotente)
#   tools/serve.sh --ensure   -> igual, silencioso; pensado para el autoarranque
#   tools/serve.sh --watch    -> bucle que lo revive cada 15 s (primer plano)
#
# Resolucion de PHP (en cascada, primera que funcione):
#   1. PHP portatil incluido en /workspace/.php-runtime (persiste entre sesiones).
#   2. php del sistema, si esta instalado.
#   3. Instalacion por apt (sudo sin contrasena), y se copia a /workspace.
#
# Caracteristicas:
#   - Escucha en 0.0.0.0:12000 para que el proxy del entorno lo publique.
#   - Arranca el servidor con setsid, asi sobrevive al cierre del terminal.
#   - Idempotente: ejecutarlo muchas veces deja un solo servidor.
#
# Este script NO va en el ZIP de despliegue (tools/ esta excluido).
# En un hosting real no hace falta: PHP esta siempre encendido.
# =============================================================================
cd "$(dirname "$0")/.." || exit 1

PORT="${PORT:-12000}"
LOG="${SERVE_LOG:-/tmp/php_server.log}"
PORTABLE="/workspace/.php-runtime"
PHP_BIN=""                     # se rellena en resolve_php()
MODE="${1:-}"

# --- Utilidades --------------------------------------------------------------

server_alive() { pgrep -f -- "-S 0.0.0.0:$PORT" >/dev/null 2>&1; }

resolve_php() {
  # 1. Portatil persistente.
  if [ -x "$PORTABLE/bin/php" ]; then
    PHP_BIN="$PORTABLE/bin/php -c $PORTABLE/etc/php.ini"
    # Las libs compartidas viajan con el runtime portatil.
    [ -d "$PORTABLE/lib" ] && export LD_LIBRARY_PATH="$PORTABLE/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
    return 0
  fi
  # 2. PHP del sistema.
  if command -v php >/dev/null 2>&1; then
    PHP_BIN="php"
    return 0
  fi
  # 3. Instalar y empaquetar en /workspace para no repetir la instalacion.
  [ "$MODE" = "--ensure" ] || echo "[serve] PHP no esta; instalando..."
  sudo -n apt-get update -qq >/dev/null 2>&1
  sudo -n apt-get install -y -qq php-cli php-sqlite3 php-mbstring php-curl >/dev/null 2>&1
  if command -v php >/dev/null 2>&1; then
    bundle_portable_php
    PHP_BIN="$PORTABLE/bin/php -c $PORTABLE/etc/php.ini"
    return 0
  fi
  return 1
}

# Copia el PHP del sistema (+ libs y php.ini) a /workspace para sobrevivir al reinicio.
bundle_portable_php() {
  local real extdir inifile lib
  real="$(readlink -f "$(command -v php)")"
  extdir="$(php -r 'echo ini_get("extension_dir");')"
  inifile="$(php --ini | awk -F': ' '/Loaded Configuration/{print $2}')"
  mkdir -p "$PORTABLE/bin" "$PORTABLE/ext" "$PORTABLE/etc" "$PORTABLE/lib"
  cp "$real" "$PORTABLE/bin/php"
  [ -d "$extdir" ] && cp "$extdir"/*.so "$PORTABLE/ext/" 2>/dev/null
  [ -f "$inifile" ] && cp "$inifile" "$PORTABLE/etc/system.ini"
  # Librerias compartidas que falten en la imagen base (p. ej. libsodium, libargon2).
  while read -r lib; do
    [ -n "$lib" ] && cp -a "$lib"* "$PORTABLE/lib/" 2>/dev/null
  done < <(ldd "$real" 2>/dev/null | awk '/not found/{print $1}' | while read -r n; do
             find / -name "$n" 2>/dev/null | head -1
           done)
  write_portable_ini
}

# Genera un php.ini minimo que carga las extensiones incluidas.
write_portable_ini() {
  {
    echo "; php.ini del PHP portatil de C-ROTULUS (vista previa)."
    echo "extension_dir = $PORTABLE/ext"
    for so in "$PORTABLE"/ext/*.so; do
      [ -e "$so" ] || continue
      m="$(basename "$so" .so)"
      if [ "$m" = "opcache" ]; then echo "zend_extension=opcache.so"
      else echo "extension=$m.so"; fi
    done
    echo "date.timezone = Europe/Madrid"
  } > "$PORTABLE/etc/php.ini"
}

start_server() {
  resolve_php || { [ "$MODE" = "--ensure" ] || echo "[serve] ERROR: no hay PHP"; return 1; }
  server_alive && { [ "$MODE" = "--ensure" ] || echo "[serve] ya estaba en marcha"; return 0; }
  setsid nohup $PHP_BIN -S 0.0.0.0:"$PORT" -t . >>"$LOG" 2>&1 </dev/null &
  sleep 1
  server_alive && { [ "$MODE" = "--ensure" ] || echo "[serve] arrancado en el puerto $PORT"; return 0; }
  return 1
}

# --- Ejecucion ---------------------------------------------------------------

launch_watchdog() {
  # Lanza el vigilante en segundo plano si no hay ya uno activo (lo decide su flock).
  setsid nohup bash "$0" --watch >>"$LOG" 2>&1 </dev/null &
}

case "$MODE" in
  --watch)
    # Un solo vigilante a la vez: el lock queda tomado mientras dure el bucle.
    exec 8>"/tmp/crotulus-watch.lock"
    flock -n 8 || { start_server; exit 0; }
    start_server
    echo "[serve] vigilante activo (Ctrl+C para salir)"
    while true; do
      server_alive || { echo "[serve] caido; reiniciando..."; start_server; }
      sleep 15
    done
    ;;
  --ensure)
    # Autoarranque silencioso: levanta el servidor y deja un vigilante en segundo plano.
    start_server
    launch_watchdog
    ;;
  *)
    start_server
    ;;
esac
