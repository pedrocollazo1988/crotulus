#!/usr/bin/env bash
# =============================================================================
# serve-next.sh - Vista previa local de C-ROTULUS (Next.js + PostgreSQL).
#
# Sustituye a tools/serve.sh (backend PHP). Levanta:
#   1. PostgreSQL portatil (tools/pgdev.sh) en 127.0.0.1:5432.
#   2. El servidor de Next.js en 0.0.0.0:12000.
#
# Modos:
#   tools/serve-next.sh            -> arranca si hace falta y sale (idempotente)
#   tools/serve-next.sh --ensure   -> igual, silencioso (autoarranque de sesion)
#   tools/serve-next.sh --watch    -> bucle que lo revive cada 15 s (primer plano)
#   tools/serve-next.sh --prod     -> compila y arranca "next start" (build real)
#
# El sandbox se recrea entre sesiones: solo persiste /workspace, asi que la BD
# vive en /workspace/.pg-runtime y las dependencias en node_modules.
# En Vercel NO se usa: alli el build y el runtime los gestiona la plataforma.
# =============================================================================
cd "$(dirname "$0")/.." || exit 1

PORT="${PORT:-12000}"
LOG="${SERVE_LOG:-/tmp/next_server.log}"
MODE="${1:-}"

server_alive() { pgrep -f -- "next(-server)? .*$PORT" >/dev/null 2>&1 || pgrep -f -- "next dev -p $PORT" >/dev/null 2>&1; }

ensure_deps() {
  [ -d node_modules/next ] && return 0
  [ "$MODE" = "--ensure" ] || echo "[serve-next] instalando dependencias..."
  npm install >/dev/null 2>&1
}

start_server() {
  ensure_deps || { [ "$MODE" = "--ensure" ] || echo "[serve-next] ERROR: npm install fallo"; return 1; }
  bash tools/pgdev.sh --ensure >/dev/null 2>&1
  server_alive && { [ "$MODE" = "--ensure" ] || echo "[serve-next] ya estaba en marcha"; return 0; }

  if [ "$MODE" = "--prod" ]; then
    [ "$MODE" = "--ensure" ] || echo "[serve-next] compilando (next build)..."
    npm run build >>"$LOG" 2>&1 || { echo "[serve-next] ERROR: el build fallo (ver $LOG)"; return 1; }
    setsid nohup npx next start -p "$PORT" >>"$LOG" 2>&1 </dev/null &
  else
    setsid nohup npx next dev -p "$PORT" >>"$LOG" 2>&1 </dev/null &
  fi

  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    server_alive && { [ "$MODE" = "--ensure" ] || echo "[serve-next] arrancado en el puerto $PORT"; return 0; }
  done
  return 1
}

case "$MODE" in
  --watch)
    exec 8>"/tmp/crotulus-next-watch.lock"
    flock -n 8 || { start_server; exit 0; }
    start_server
    echo "[serve-next] vigilante activo (Ctrl+C para salir)"
    while true; do
      server_alive || { echo "[serve-next] caido; reiniciando..."; start_server; }
      sleep 15
    done
    ;;
  --ensure)
    start_server
    setsid nohup bash "$0" --watch >>"$LOG" 2>&1 </dev/null &
    ;;
  *)
    start_server
    ;;
esac
