<?php
declare(strict_types=1);

/**
 * Utilidades generales: lectura de configuracion, entrada de peticiones,
 * respuestas JSON y registro de eventos.
 */

/** Devuelve la configuracion (o una clave concreta con notacion "a.b"). */
function config(?string $key = null, $default = null)
{
    $cfg = $GLOBALS['CROTULUS_CONFIG'] ?? [];
    if ($key === null) {
        return $cfg;
    }
    $ref = $cfg;
    foreach (explode('.', $key) as $part) {
        if (!is_array($ref) || !array_key_exists($part, $ref)) {
            return $default;
        }
        $ref = $ref[$part];
    }
    return $ref;
}

/** Datos enviados como JSON o como formulario, unificados en un array. */
function request_input(): array
{
    static $data = null;
    if ($data !== null) {
        return $data;
    }
    $data = [];
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'application/json') !== false) {
        $raw  = file_get_contents('php://input') ?: '';
        $json = json_decode($raw, true);
        if (is_array($json)) {
            $data = $json;
        }
    }
    if (!$data) {
        $data = $_POST ?: [];
    }
    return $data;
}

/** Devuelve un valor de entrada ya recortado. */
function input(string $key, $default = ''): string
{
    $data = request_input();
    $val  = $data[$key] ?? $default;
    if (is_array($val)) {
        return '';
    }
    return trim((string) $val);
}

/** Respuesta JSON uniforme y fin de la ejecucion. */
function json_response($payload, int $status = 200): void
{
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Respuesta de exito: { ok: true, ...datos }. */
function json_ok(array $data = []): void
{
    json_response(array_merge(['ok' => true], $data));
}

/** Respuesta de error: { ok: false, error, detalle? }. */
function json_error(string $error, int $status = 400, array $extra = []): void
{
    json_response(array_merge(['ok' => false, 'error' => $error], $extra), $status);
}

/** IP del visitante. Solo confia en cabeceras de proxy si este esta declarado. */
function client_ip(): string
{
    $remote = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

    $trusted = (array) config('security.trusted_proxies', []);
    if ($trusted && in_array($remote, $trusted, true)) {
        foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR'] as $key) {
            if (empty($_SERVER[$key])) {
                continue;
            }
            $value = trim(explode(',', (string) $_SERVER[$key])[0]);
            if (filter_var($value, FILTER_VALIDATE_IP)) {
                return $value;
            }
        }
    }

    return filter_var($remote, FILTER_VALIDATE_IP) ? $remote : '0.0.0.0';
}

/** Registra un mensaje en el registro de la aplicación (sin datos sensibles). */
function app_log(string $message): void
{
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $message . PHP_EOL;
    @file_put_contents(log_dir() . '/app.log', $line, FILE_APPEND | LOCK_EX);
}

/**
 * Carpeta donde se escriben los registros (app.log, mail.log).
 * Por defecto es app/data; el administrador puede cambiarla desde Ajustes
 * (clave "paths.log_dir") para separarlos de los datos de la base de datos.
 */
function log_dir(): string
{
    $dir = trim((string) config('paths.log_dir', ''));
    if ($dir === '') {
        return DATA_DIR;
    }
    $dir = rtrim($dir, '/\\');
    if (!is_dir($dir)) {
        @mkdir($dir, 0750, true);
    }
    return is_dir($dir) ? $dir : DATA_DIR;
}

/** Construye la URL publica del sitio (con soporte para subcarpetas). */
function site_base_url(): string
{
    $configured = trim((string) config('site_url', ''));
    if ($configured !== '') {
        return rtrim($configured, '/');
    }
    // Detecta HTTPS teniendo en cuenta proxies/CDN (X-Forwarded-*), igual que la sesion.
    $proto = strtolower(trim(explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''))[0]));
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || $proto === 'https'
        || (($_SERVER['HTTP_X_FORWARDED_SSL'] ?? '') === 'on')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443');
    $scheme = $https ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $dir    = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
    $dir    = preg_replace('#/(api|admin)$#', '', $dir);
    return $scheme . '://' . $host . $dir;
}

/** Enlace absoluto a un recurso del sitio. */
function url(string $path = ''): string
{
    $path = ltrim($path, '/');

    // URLs "limpias" (sin .php): imprescindible en Vercel, donde el firewall
    // bloquea cualquier URL terminada en .php. Tanto el Caddyfile (contenedor
    // en Vercel) como el .htaccess (hosting con Apache) resuelven /admin/login
    // hacia /admin/login.php. La cadena de consulta (?...) no se modifica.
    $query = '';
    if (($q = strpos($path, '?')) !== false) {
        $query = substr($path, $q);
        $path  = substr($path, 0, $q);
    }
    if (substr($path, -4) === '.php') {
        $path = substr($path, 0, -4);
    }

    return site_base_url() . '/' . $path . $query;
}
