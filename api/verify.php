<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  VERIFICACION DE CORREO  ->  GET /api/verify.php?token=...
 *  Marca la cuenta como activa y muestra una pagina de resultado.
 * ============================================================================
 */

require_once __DIR__ . '/../app/bootstrap.php';

$token = (string) ($_GET['token'] ?? '');
$user  = $token !== '' ? auth_consume_token('email_verify', $token) : null;

if ($user) {
    db_update('users', [
        'status'            => 'active',
        'email_verified_at' => $user['email_verified_at'] ?: date('Y-m-d H:i:s'),
        'updated_at'        => date('Y-m-d H:i:s'),
    ], 'id = :id', ['id' => (int) $user['id']]);
    audit('email_verified', ['id' => (int) $user['id']]);

    // Inicia sesion automaticamente tras verificar.
    $fresh = db_one('SELECT * FROM users WHERE id = ?', [(int) $user['id']]);
    auth_login($fresh);

    $title   = 'Correo verificado';
    $message = 'Tu cuenta ya está activa. Te hemos iniciado la sesión.';
    $ok      = true;
} else {
    $title   = 'Enlace no válido';
    $message = 'El enlace de verificación ha caducado o ya se ha usado. Vuelve a registrarte o pide un enlace nuevo.';
    $ok      = false;
}

render_result($title, $message, $ok);

/** Pagina HTML sencilla con el resultado. */
function render_result(string $title, string $message, bool $ok): void
{
    $base    = e(site_base_url());
    $color   = $ok ? '#005AA5' : '#B42318';
    $site    = e((string) config('site_name'));
    http_response_code(200);
    header('Content-Type: text/html; charset=utf-8');
    echo "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\">"
        . "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
        . "<title>" . e($title) . " · $site</title>"
        . "<style>body{font-family:Arial,Helvetica,sans-serif;background:#f4f7fc;display:flex;"
        . "min-height:100vh;align-items:center;justify-content:center;margin:0}"
        . ".box{background:#fff;border-radius:16px;padding:40px;max-width:440px;text-align:center;"
        . "box-shadow:0 10px 40px rgba(8,36,61,.10)}"
        . "h1{color:$color;font-size:22px;margin:0 0 12px}p{color:#1F2A37;line-height:1.6}"
        . "a.btn{display:inline-block;margin-top:18px;background:#005AA5;color:#fff;text-decoration:none;"
        . "padding:12px 22px;border-radius:10px;font-weight:600}</style></head><body>"
        . "<div class=\"box\"><h1>" . e($title) . "</h1><p>" . e($message) . "</p>"
        . "<a class=\"btn\" href=\"$base/admin/\">Ir al panel</a></div></body></html>";
}
