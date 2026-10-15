#!/usr/bin/env bash
# ============================================================================
#  C-ROTULUS · DESPLIEGUE POR SSH/rsync  (nivel avanzado: VPS o hosting con SSH)
# ----------------------------------------------------------------------------
#  Sincroniza el sitio con el servidor sin borrar tus datos ni tu configuracion.
#
#  USO:
#      ./deploy/deploy.sh usuario@tu-servidor.com /var/www/tu-dominio/public_html
#
#  Requisitos: ssh y rsync en tu equipo; acceso SSH al servidor.
#  El archivo app/config.local.php NO se sobrescribe (contiene contrasenas).
# ============================================================================
set -u

DESTINO="${1:-}"
REMOTO_DIR="${2:-}"

if [ -z "$DESTINO" ] || [ -z "$REMOTO_DIR" ]; then
  echo "Uso: $0 usuario@servidor /ruta/al/public_html"
  exit 1
fi

ORIGEN="$(cd "$(dirname "$0")/.." && pwd)/"

echo ">> Sincronizando C-ROTULUS con ${DESTINO}:${REMOTO_DIR} ..."

rsync -az --delete \
  --exclude 'app/config.local.php' \
  --exclude 'app/data/c-rotulus.sqlite' \
  --exclude 'app/data/backups' \
  --exclude 'app/data/*.log' \
  --exclude '.git' \
  --exclude '.agent_tmp' \
  --exclude 'c-rotulus-sitio.zip' \
  --exclude 'deploy' \
  "$ORIGEN" "${DESTINO}:${REMOTO_DIR}/"

echo ">> Archivos copiados. Fijando permisos..."
ssh "$DESTINO" "chmod -R 755 '${REMOTO_DIR}' && chmod -R 750 '${REMOTO_DIR}/app/data' 2>/dev/null || true"

echo ">> Listo. Comprueba el diagnostico con:"
echo "   ssh ${DESTINO} 'php ${REMOTO_DIR}/app/preflight.php'"
