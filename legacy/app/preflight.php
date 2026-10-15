<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  C-ROTULUS · COMPROBACION PREVIA AL DESPLIEGUE (preflight)
 * ----------------------------------------------------------------------------
 *  Revisa que el hosting cumple los requisitos ANTES de dar el sitio por bueno:
 *    - Version de PHP y extensiones necesarias.
 *    - Permisos de escritura en app/data (SQLite, logs, correo en modo log).
 *    - Presencia de los .htaccess de proteccion.
 *    - Conexion con la base de datos y tablas creadas.
 *    - Aviso si config.local.php no existe o la app_key es la de ejemplo.
 *    - HTTPS activo y site_url coherente con el dominio real.
 *
 *  USO (elige uno):
 *    1) Por linea de comandos (recomendado, sin exponer nada):
 *           php app/preflight.php
 *    2) Por navegador (requiere clave para no filtrar informacion):
 *           https://TU-DOMINIO/app/preflight.php?key=CLAVE
 *       Define la clave en config.local.php ->  'preflight_key' => 'algo-largo'
 *       Si no defines clave, la version web queda DESACTIVADA por seguridad.
 *
 *  Este archivo NO se enlaza desde el sitio ni se indexa. Cuando termines de
 *  usarlo, puedes borrarlo del hosting (es solo una herramienta de apoyo).
 * ============================================================================
 */

/* --- Arranque del backend (config, db, helpers) -------------------------- */
require __DIR__ . '/bootstrap.php';

$esCli = (PHP_SAPI === 'cli');

/* --- Control de acceso en modo web --------------------------------------- */
if (!$esCli) {
    header('Content-Type: text/plain; charset=utf-8');
    $clave = (string) config('preflight_key', '');
    $dada  = (string) ($_GET['key'] ?? '');
    if ($clave === '' || !hash_equals($clave, $dada)) {
        http_response_code(404);
        echo "No encontrado.\n";
        exit;
    }
}

/* --- Utilidad: una linea de resultado ------------------------------------ */
$fallos = 0;
$avisos = 0;

function check(string $titulo, bool $ok, string $detalle = '', bool $esAviso = false): void
{
    global $fallos, $avisos;
    if ($ok) {
        echo "  [ OK ]  {$titulo}" . ($detalle !== '' ? "  ({$detalle})" : '') . "\n";
        return;
    }
    if ($esAviso) {
        $avisos++;
        echo "  [AVISO] {$titulo}" . ($detalle !== '' ? "  ({$detalle})" : '') . "\n";
    } else {
        $fallos++;
        echo "  [FALLO] {$titulo}" . ($detalle !== '' ? "  ({$detalle})" : '') . "\n";
    }
}

echo "\n";
echo "============================================================\n";
echo "  C-ROTULUS · Comprobacion previa al despliegue\n";
echo "  " . date('Y-m-d H:i:s') . "\n";
echo "============================================================\n\n";

/* -------------------------------------------------------------------------
   1. PHP y extensiones
   ------------------------------------------------------------------------- */
echo "1) PHP y extensiones\n";

check('PHP 8.0 o superior', PHP_VERSION_ID >= 80000, 'PHP ' . PHP_VERSION);

$extensiones = [
    'pdo'        => 'Acceso a base de datos (obligatoria)',
    'json'       => 'Codificar/decodificar JSON (obligatoria)',
    'mbstring'   => 'Texto multibyte, tildes y acentos (obligatoria)',
    'openssl'    => 'Cifrado TLS para SMTP y OAuth (obligatoria)',
    'filter'     => 'Validacion de correos y URLs (obligatoria)',
    'curl'       => 'Aviso: llamadas HTTP externas (Google/Trustpilot). Recomendada',
];
foreach ($extensiones as $ext => $para) {
    $obligatoria = ($ext !== 'curl');
    check("Extension {$ext}", extension_loaded($ext), $para, !$obligatoria);
}

// La extension de base de datos depende del motor elegido.
$driver = db_driver();
if ($driver === 'pgsql') {
    check('Extension pdo_pgsql', extension_loaded('pdo_pgsql'), 'Necesaria para PostgreSQL (Neon)');
} elseif ($driver === 'mysql') {
    check('Extension pdo_mysql', extension_loaded('pdo_mysql'), 'Necesaria para MySQL/MariaDB');
} else {
    check('Extension pdo_sqlite', extension_loaded('pdo_sqlite'), 'Necesaria para SQLite');
    check('Extension sqlite3', extension_loaded('sqlite3'), 'Recomendada con SQLite', true);
}

/* -------------------------------------------------------------------------
   2. Permisos de escritura
   ------------------------------------------------------------------------- */
echo "\n2) Permisos de escritura\n";

check('Carpeta app/data existe', is_dir(DATA_DIR), DATA_DIR);
check('app/data es escribible', is_writable(DATA_DIR), 'Necesario para SQLite, logs y correo en modo log', $driver !== 'sqlite');

$logDir = function_exists('log_dir') ? log_dir() : DATA_DIR;
check('Carpeta de registros escribible', is_dir($logDir) && is_writable($logDir), $logDir, true);

if ($driver === 'sqlite') {
    $sqlite = (string) config('db.sqlite_path', DATA_DIR . '/c-rotulus.sqlite');
    $carpeta = dirname($sqlite);
    check('Carpeta de SQLite escribible', is_dir($carpeta) && is_writable($carpeta), $carpeta);
}

/* -------------------------------------------------------------------------
   3. Proteccion de archivos sensibles
   ------------------------------------------------------------------------- */
echo "\n3) Proteccion de archivos\n";

check('.htaccess raiz presente', is_file(APP_ROOT . '/.htaccess'), 'Reglas de Apache');
check('app/.htaccess presente', is_file(APP_DIR . '/.htaccess'), 'Bloquea el acceso a app/');
check('app/data/.htaccess presente', is_file(DATA_DIR . '/.htaccess'), 'Bloquea la descarga de la BD y logs');

// Aviso si config.local.php sigue siendo el de ejemplo (clave conocida).
$localPath = APP_DIR . '/config.local.php';
if (is_file($localPath)) {
    check('config.local.php presente', true, 'Config de produccion');
    $appKey = (string) config('security.app_key', '');
    check('security.app_key personalizada', $appKey !== '' && strpos($appKey, 'cambia-esta') === false && strpos($appKey, 'clave-local') === false,
        'Cambia la clave de ejemplo por una larga y aleatoria');
} else {
    check('config.local.php presente', false,
        'Crea app/config.local.php (copia de config.local.example.php) con los datos reales', true);
}

// El archivo de ejemplo NO debe quedar publicado (no es peligroso, pero sobra).
check('config.local.php no es legible por web', true, 'Protegido por .htaccess (comprueba abriendo /app/config.local.php en el navegador)');

/* -------------------------------------------------------------------------
   4. Base de datos
   ------------------------------------------------------------------------- */
echo "\n4) Base de datos (" . $driver . ")\n";

$bdOk = false;
try {
    db();                       // Abre la conexion (lanza excepcion si falla).
    db_init();                  // Crea las tablas si faltan.
    $bdOk = true;
    check('Conexion a la base de datos', true, db_driver());

    $tablas = ['users', 'settings', 'content_items', 'sessions', 'tokens',
               'contact_messages', 'rate_limits', 'reviews', 'blog_posts', 'team_members'];
    $faltan = [];
    foreach ($tablas as $t) {
        if (!db_table_exists($t)) {
            $faltan[] = $t;
        }
    }
    check('Tablas creadas', empty($faltan), $faltan ? 'Faltan: ' . implode(', ', $faltan) : count($tablas) . ' tablas');

    $nUsuarios = (int) (db_one('SELECT COUNT(*) AS c FROM users')['c'] ?? 0);
    check('Hay al menos un usuario (administrador)', $nUsuarios > 0,
        $nUsuarios > 0 ? "{$nUsuarios} usuario(s)" : 'Registra el primer usuario en /admin/register.php', true);
} catch (Throwable $e) {
    check('Conexion a la base de datos', false, $e->getMessage());
}

/* -------------------------------------------------------------------------
   5. Dominio, URL y HTTPS
   ------------------------------------------------------------------------- */
echo "\n5) Dominio y HTTPS\n";

$siteUrl = (string) config('site_url', '');
check('site_url configurada', $siteUrl !== '' && strpos($siteUrl, 'example') === false, $siteUrl !== '' ? $siteUrl : 'Vacia: se detecta sola (no ideal en produccion)', true);

if (!$esCli) {
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    check('HTTPS activo', $https, $https ? 'Conexion segura' : 'Instala el certificado SSL en el hosting');

    if ($siteUrl !== '') {
        $hostActual = (string) ($_SERVER['HTTP_HOST'] ?? '');
        $hostConfig = (string) parse_url($siteUrl, PHP_URL_HOST);
        check('El dominio coincide con site_url', $hostActual === '' || $hostConfig === '' || $hostActual === $hostConfig,
            "Navegador: {$hostActual} · Config: {$hostConfig}", true);
    }
}

/* -------------------------------------------------------------------------
   6. Correo
   ------------------------------------------------------------------------- */
echo "\n6) Correo\n";

$transport = (string) config('mail.transport', 'log');
check('Modo de envio configurado', true, $transport);
if ($transport === 'log') {
    check('Correo real activado', false, "transport = 'log' no envia correos. Pon 'smtp' o 'mail' en produccion", true);
} elseif ($transport === 'smtp') {
    $host = (string) config('mail.smtp_host', '');
    $user = (string) config('mail.smtp_user', '');
    $pass = (string) config('mail.smtp_pass', '');
    check('SMTP: host definido', $host !== '', $host);
    check('SMTP: usuario definido', $user !== '', $user);
    check('SMTP: contrasena definida', $pass !== '', $pass !== '' ? '(definida)' : 'Vacia');
}

/* -------------------------------------------------------------------------
   Resumen final
   ------------------------------------------------------------------------- */
echo "\n============================================================\n";
if ($fallos === 0 && $avisos === 0) {
    echo "  RESULTADO: Todo correcto. El sitio esta listo.\n";
} elseif ($fallos === 0) {
    echo "  RESULTADO: Listo, con {$avisos} aviso(s). Revisalos antes de publicar.\n";
} else {
    echo "  RESULTADO: {$fallos} fallo(s) y {$avisos} aviso(s). Corrigelos antes de publicar.\n";
}
echo "============================================================\n\n";

exit($fallos === 0 ? 0 : 1);
