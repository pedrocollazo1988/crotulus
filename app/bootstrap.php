<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  ARRANQUE COMUN DEL BACKEND
 *  Carga la configuracion, prepara la base de datos y algunas utilidades
 *  que usan tanto la API publica como el panel de administracion.
 * ============================================================================
 */

if (defined('CROTULUS_BOOTSTRAPPED')) {
    return;
}
define('CROTULUS_BOOTSTRAPPED', true);

define('APP_ROOT', dirname(__DIR__));
define('APP_DIR', __DIR__);
define('DATA_DIR', __DIR__ . '/data');

/* --- Version de los recursos del panel (cache-busting) -------------------
   Sube este valor al editar admin.css o admin-auth.js para que los
   navegadores no usen la version guardada en cache. */
define('APP_ASSET_VERSION', '20261015b');

/* --- Configuracion: config.local.php tiene prioridad ---------------------- */
$config = require APP_DIR . '/config.php';
if (is_file(APP_DIR . '/config.local.php')) {
    $local  = require APP_DIR . '/config.local.php';
    $config = array_replace_recursive($config, is_array($local) ? $local : []);
}
$GLOBALS['CROTULUS_CONFIG'] = $config;

/* --- Zona horaria --------------------------------------------------------- */
date_default_timezone_set($config['timezone'] ?? 'UTC');

/* --- Errores: nunca mostrar detalles al visitante ------------------------- */
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

/* --- Cabeceras de seguridad (se aplican tambien en el servidor web) ------- */
if (!headers_sent()) {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: geolocation=(), microphone=(), camera=()');
    header('Cross-Origin-Opener-Policy: same-origin');
}

/* --- Aseguramos la carpeta de datos (SQLite, registros, correo en log) ---- */
if (!is_dir(DATA_DIR)) {
    @mkdir(DATA_DIR, 0750, true);
}
if (is_file(APP_DIR . '/.htaccess') === false) {
    @file_put_contents(
        APP_DIR . '/.htaccess',
        "Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n"
    );
}

require_once APP_DIR . '/lib/helpers.php';
require_once APP_DIR . '/lib/db.php';
require_once APP_DIR . '/lib/security.php';
require_once APP_DIR . '/lib/validator.php';
require_once APP_DIR . '/lib/http.php';
require_once APP_DIR . '/lib/mailer.php';
require_once APP_DIR . '/lib/auth.php';
require_once APP_DIR . '/lib/settings.php';
require_once APP_DIR . '/lib/reviews.php';
require_once APP_DIR . '/lib/faq.php';
require_once APP_DIR . '/lib/submissions.php';

/* --- Los ajustes guardados en la base de datos tienen prioridad -----------
   Permiten cambiar correo, seguridad, etc. desde el panel sin editar
   app/config.php. Si aún no hay base de datos, se mantiene config.php. */
settings_apply_overrides($GLOBALS['CROTULUS_CONFIG']);

/* --- Inicializa la base de datos (crea el esquema la primera vez) --------- */
db_init();

/* --- Arranca la sesion de forma segura ------------------------------------ */
security_start_session();
