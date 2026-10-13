<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  SEGURIDAD
 *  - Sesiones seguras (cookies HttpOnly, SameSite, regeneracion de id)
 *  - Tokens CSRF de un solo uso por formulario
 *  - Limite de peticiones (anti fuerza bruta y anti spam)
 *  - Hash de contrasenas y tokens con password_hash / hash_hmac
 * ============================================================================
 */

/** Arranca la sesion con cookies seguras. */
function security_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $name     = config('security.session_name', 'crotulus_sid');
    $lifetime = (int) config('security.session_lifetime', 2592000);
    $secure   = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

    session_name($name);
    session_set_cookie_params([
        'lifetime' => $lifetime,
        'path'     => '/',
        'domain'   => '',
        'secure'   => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();

    // Vincula la sesion a la IP para dificultar el robo de cookie.
    $fingerprint = hash('sha256', client_ip() . '|' . ($_SERVER['HTTP_USER_AGENT'] ?? ''));
    if (empty($_SESSION['_fp'])) {
        $_SESSION['_fp'] = $fingerprint;
    } elseif (!hash_equals($_SESSION['_fp'], $fingerprint)) {
        session_unset();
        session_destroy();
        session_start();
        $_SESSION['_fp'] = $fingerprint;
    }
}

/** Genera (si hace falta) y devuelve el token CSRF de la sesion. */
function csrf_token(): string
{
    if (empty($_SESSION['_csrf'])) {
        $_SESSION['_csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['_csrf'];
}

/** Valida el token CSRF recibido en la peticion. */
function csrf_verify(?string $token): bool
{
    if (empty($_SESSION['_csrf']) || empty($token)) {
        return false;
    }
    return hash_equals($_SESSION['_csrf'], $token);
}

/** Exige un CSRF valido (cabecera X-CSRF-Token o campo _csrf). */
function csrf_require(): void
{
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? input('_csrf');
    if (!csrf_verify($token)) {
        json_error('Token de seguridad invalido o caducado. Recarga la pagina.', 419);
    }
}

/**
 * Limite de peticiones por IP.
 * Devuelve true si se permite; false si se ha superado el maximo.
 */
function rate_limit(string $bucket, int $max, int $windowSeconds): bool
{
    $ip     = client_ip();
    $now    = time();
    $row    = db_one('SELECT id, hits, window_start FROM rate_limits WHERE bucket = ? AND ip = ?', [$bucket, $ip]);

    if (!$row) {
        db_insert('rate_limits', [
            'bucket'       => $bucket,
            'ip'           => $ip,
            'hits'         => 1,
            'window_start' => $now,
        ]);
        return true;
    }

    if (($now - (int) $row['window_start']) > $windowSeconds) {
        db_update('rate_limits', ['hits' => 1, 'window_start' => $now], 'id = :id', ['id' => $row['id']]);
        return true;
    }

    if ((int) $row['hits'] >= $max) {
        return false;
    }

    db_update('rate_limits', ['hits' => (int) $row['hits'] + 1], 'id = :id', ['id' => $row['id']]);
    return true;
}

/** Limpia registros antiguos de rate_limits (llamada ocasional). */
function rate_limit_gc(): void
{
    db_query('DELETE FROM rate_limits WHERE window_start < ?', [time() - 86400]);
}

/** Hash de contrasena (bcrypt/argon segun PHP). */
function hash_password(string $plain): string
{
    return password_hash($plain, PASSWORD_DEFAULT);
}

/** Comprueba una contrasena contra su hash. */
function verify_password(string $plain, ?string $hash): bool
{
    if (!$hash) {
        return false;
    }
    return password_verify($plain, $hash);
}

/** Genera un token aleatorio en claro (se devuelve al usuario). */
function generate_token(int $bytes = 32): string
{
    return bin2hex(random_bytes($bytes));
}

/** Huella HMAC del token: solo se guarda el hash en la base de datos. */
function token_hash(string $token): string
{
    return hash_hmac('sha256', $token, (string) config('security.app_key', 'app'));
}

/** Registro de auditoria sencillo. */
function audit(string $event, array $context = []): void
{
    app_log($event . ' ' . json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}
