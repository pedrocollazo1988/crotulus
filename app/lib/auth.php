<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  AUTENTICACION
 *  Registro, inicio de sesion, verificacion por correo, recuperacion de
 *  contraseña y acceso con Google (OAuth 2.0).
 * ============================================================================
 */

/** Usuario autenticado actual (o null). */
function current_user(): ?array
{
    static $cached = false;
    static $user   = null;

    if ($cached) {
        return $user;
    }
    $cached = true;

    if (empty($_SESSION['uid']) || empty($_SESSION['sid'])) {
        return null;
    }

    $session = db_one('SELECT * FROM sessions WHERE id = ?', [$_SESSION['sid']]);
    if (!$session || $session['revoked_at'] || strtotime((string) $session['expires_at']) < time()) {
        auth_forget_session();
        return null;
    }

    $user = db_one('SELECT * FROM users WHERE id = ?', [(int) $_SESSION['uid']]);
    if (!$user || $user['status'] === 'banned') {
        auth_forget_session();
        $user = null;
    }
    return $user;
}

/** true si hay sesion iniciada. */
function is_logged_in(): bool
{
    return current_user() !== null;
}

/** true si el usuario es administrador. */
function is_admin(): bool
{
    $u = current_user();
    return $u !== null && $u['role'] === 'admin';
}

/** Exige sesion iniciada (para el panel). */
function require_login(): void
{
    if (!is_logged_in()) {
        header('Location: ' . url('admin/login.php'));
        exit;
    }
}

/** Exige sesión iniciada (para la API de solo usuarios). Devuelve el usuario. */
function require_user(): array
{
    if (!is_logged_in()) {
        json_error('Inicia sesión para continuar.', 401);
    }
    return current_user();
}

/** Exige rol de administrador para gestionar el panel. */
function require_admin(): void
{
    require_login();
    if (!is_admin()) {
        http_response_code(403);
        header('Content-Type: text/html; charset=utf-8');
        echo '<!doctype html><html lang="es"><head><meta charset="utf-8">'
            . '<meta name="viewport" content="width=device-width,initial-scale=1">'
            . '<title>Sin permiso</title></head><body style="font-family:system-ui;padding:40px">'
            . '<h1>Acceso restringido</h1><p>Tu cuenta no tiene permisos de administrador.</p>'
            . '<p><a href="' . e(url('admin/logout.php')) . '">Cerrar sesión</a> · '
            . '<a href="' . e(url('')) . '">Volver a la web</a></p></body></html>';
        exit;
    }
}

/** true si es el primer usuario del sistema (se le da rol de administrador). */
function auth_is_first_user(): bool
{
    $row = db_one('SELECT COUNT(*) AS c FROM users');
    return ((int) ($row['c'] ?? 0)) === 0;
}

/** Crea la sesion del usuario en la base de datos y en la cookie. */
function auth_login(array $user): void
{
    $token   = generate_token(32);
    $expires = date('Y-m-d H:i:s', time() + (int) config('security.session_lifetime', 2592000));

    $sid = db_insert('sessions', [
        'user_id'    => (int) $user['id'],
        'token_hash' => token_hash($token),
        'ip'         => client_ip(),
        'user_agent' => mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
        'created_at' => date('Y-m-d H:i:s'),
        'expires_at' => $expires,
    ]);

    db_update('users', ['last_login_at' => date('Y-m-d H:i:s')], 'id = :id', ['id' => (int) $user['id']]);

    session_regenerate_id(true);
    $_SESSION['uid'] = (int) $user['id'];
    $_SESSION['sid'] = $sid;
}

/** Cierra la sesion actual. */
function auth_logout(): void
{
    if (!empty($_SESSION['sid'])) {
        db_update('sessions', ['revoked_at' => date('Y-m-d H:i:s')], 'id = :id', ['id' => (int) $_SESSION['sid']]);
    }
    auth_forget_session();
}

function auth_forget_session(): void
{
    unset($_SESSION['uid'], $_SESSION['sid']);
}

/** Busca un usuario por correo. */
function auth_find_by_email(string $email): ?array
{
    return db_one('SELECT * FROM users WHERE email = ?', [mb_strtolower($email)]);
}

/** Crea un usuario. Devuelve su id. */
function auth_create_user(string $email, string $name, ?string $password = null, string $status = 'pending', ?string $role = null): int
{
    if ($role === null) {
        // El primer usuario del sistema es administrador.
        $role = auth_is_first_user() ? 'admin' : 'user';
    }
    return db_insert('users', [
        'email'         => mb_strtolower($email),
        'name'          => $name,
        'password_hash' => $password !== null ? hash_password($password) : null,
        'role'          => $role,
        'status'        => $status,
        'created_at'    => date('Y-m-d H:i:s'),
        'updated_at'    => date('Y-m-d H:i:s'),
    ]);
}

/** Comprueba credenciales. Devuelve el usuario o null. */
function auth_check_credentials(string $email, string $password): ?array
{
    $user = auth_find_by_email($email);
    if (!$user) {
        // Ejecutamos un hash ficticio para igualar tiempos (anti enumeracion).
        password_verify($password, '$2y$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV');
        return null;
    }
    if (!verify_password($password, $user['password_hash'])) {
        return null;
    }
    return $user;
}

/* -------------------------------------------------------------------------
   TOKENS DE UN SOLO USO (verificacion de correo y recuperacion)
   ------------------------------------------------------------------------- */

/** Crea un token y devuelve su valor en claro. */
function auth_create_token(int $userId, string $type, int $ttlSeconds = 86400): string
{
    // Invalida los tokens anteriores del mismo tipo.
    db_update('tokens', ['used_at' => date('Y-m-d H:i:s')], 'user_id = :uid AND type = :t AND used_at IS NULL', [
        'uid' => $userId,
        't'   => $type,
    ]);

    $token = generate_token(32);
    db_insert('tokens', [
        'user_id'    => $userId,
        'type'       => $type,
        'token_hash' => token_hash($token),
        'expires_at' => date('Y-m-d H:i:s', time() + $ttlSeconds),
        'created_at' => date('Y-m-d H:i:s'),
    ]);
    return $token;
}

/** Consume un token valido y devuelve el usuario, o null. */
function auth_consume_token(string $type, string $token): ?array
{
    if ($token === '') {
        return null;
    }
    $row = db_one(
        'SELECT * FROM tokens WHERE type = ? AND token_hash = ? AND used_at IS NULL AND expires_at > ?',
        [$type, token_hash($token), date('Y-m-d H:i:s')]
    );
    if (!$row) {
        return null;
    }
    db_update('tokens', ['used_at' => date('Y-m-d H:i:s')], 'id = :id', ['id' => (int) $row['id']]);
    return db_one('SELECT * FROM users WHERE id = ?', [(int) $row['user_id']]);
}

/** Envia el correo de verificacion de cuenta. */
function auth_send_verification(array $user): void
{
    $token = auth_create_token((int) $user['id'], 'email_verify', 86400 * 2);
    $link  = url('api/verify.php?token=' . urlencode($token));
    $name  = e($user['name'] ?: $user['email']);

    $html = mailer_template('Verifica tu correo', "
        <p>Hola $name,</p>
        <p>Gracias por crear tu cuenta en <strong>" . e(config('site_name')) . "</strong>.
        Confirma tu correo pulsando el botón:</p>
        <p><a class='btn' href=\"$link\">Verificar mi correo</a></p>
        <p>El enlace caduca en 48 horas. Si no has sido tu, ignora este mensaje.</p>
    ");
    send_mail($user['email'], 'Verifica tu correo · ' . config('site_name'), $html);
}

/** Envia el correo para restablecer la contraseña. */
function auth_send_password_reset(array $user): void
{
    $token = auth_create_token((int) $user['id'], 'password_reset', 3600);
    $link  = url('admin/reset.php?token=' . urlencode($token));
    $name  = e($user['name'] ?: $user['email']);

    $html = mailer_template('Restablece tu contraseña', "
        <p>Hola $name,</p>
        <p>Has pedido cambiar tu contraseña. Pulsa el botón para elegir una nueva:</p>
        <p><a class='btn' href=\"$link\">Cambiar mi contraseña</a></p>
        <p>El enlace caduca en 1 hora. Si no lo has pedido, ignora este mensaje.</p>
    ");
    send_mail($user['email'], 'Restablece tu contraseña · ' . config('site_name'), $html);
}

/* -------------------------------------------------------------------------
   GOOGLE OAUTH 2.0 (flujo authorization code)
   ------------------------------------------------------------------------- */

/** true si Google esta configurado. */
function google_enabled(): bool
{
    return google_client_id() !== '';
}

/** Client ID (primero el guardado en Ajustes, luego config.php). */
function google_client_id(): string
{
    $fromSettings = (string) setting('google_client_id', '');
    return $fromSettings !== '' ? $fromSettings : (string) config('google.client_id', '');
}

/** Client secret (primero el guardado en Ajustes, luego config.php). */
function google_client_secret(): string
{
    $fromSettings = (string) setting('google_client_secret', '');
    return $fromSettings !== '' ? $fromSettings : (string) config('google.client_secret', '');
}

function google_redirect_uri(): string
{
    $configured = (string) setting('google_redirect_uri', '');
    if ($configured === '') {
        $configured = (string) config('google.redirect_uri', '');
    }
    return $configured !== '' ? $configured : url('api/auth.php?action=google_callback');
}

/** URL a la que redirigir para iniciar sesion con Google. */
function google_auth_url(): string
{
    $state = generate_token(16);
    $_SESSION['google_state'] = $state;

    $params = http_build_query([
        'client_id'     => google_client_id(),
        'redirect_uri'  => google_redirect_uri(),
        'response_type' => 'code',
        'scope'         => 'openid email profile',
        'state'         => $state,
        'access_type'   => 'online',
        'prompt'        => 'select_account',
    ]);
    return 'https://accounts.google.com/o/oauth2/v2/auth?' . $params;
}

/** Intercambia el codigo por un token de acceso. */
function google_exchange_code(string $code): ?string
{
    $response = http_post('https://oauth2.googleapis.com/token', [
        'code'          => $code,
        'client_id'     => google_client_id(),
        'client_secret' => google_client_secret(),
        'redirect_uri'  => google_redirect_uri(),
        'grant_type'    => 'authorization_code',
    ]);
    $data = json_decode((string) $response, true);
    return $data['access_token'] ?? null;
}

/** Obtiene los datos del usuario desde Google. */
function google_userinfo(string $accessToken): ?array
{
    $response = http_get('https://www.googleapis.com/oauth2/v3/userinfo', [
        'Authorization: Bearer ' . $accessToken,
    ]);
    $data = json_decode((string) $response, true);
    if (!is_array($data) || empty($data['email'])) {
        return null;
    }
    return $data;
}

/** Busca o crea el usuario de Google. Devuelve su id. */
function google_find_or_create(array $info): int
{
    $googleId = (string) ($info['sub'] ?? '');
    $email    = mb_strtolower((string) $info['email']);
    $name     = (string) ($info['name'] ?? '');
    $avatar   = (string) ($info['picture'] ?? '');

    $user = db_one('SELECT * FROM users WHERE google_id = ?', [$googleId]);
    if (!$user) {
        $user = auth_find_by_email($email);
    }

    if ($user) {
        db_update('users', [
            'google_id'         => $googleId,
            'email_verified_at' => $user['email_verified_at'] ?: date('Y-m-d H:i:s'),
            'avatar_url'        => $avatar ?: $user['avatar_url'],
            'status'            => $user['status'] === 'pending' ? 'active' : $user['status'],
            'updated_at'        => date('Y-m-d H:i:s'),
        ], 'id = :id', ['id' => (int) $user['id']]);
        return (int) $user['id'];
    }

    // Usuario nuevo verificado por Google.
    $id = db_insert('users', [
        'email'             => $email,
        'name'              => $name,
        'password_hash'     => null,
        'role'              => auth_is_first_user() ? 'admin' : 'user',
        'status'            => 'active',
        'email_verified_at' => date('Y-m-d H:i:s'),
        'google_id'         => $googleId,
        'avatar_url'        => $avatar,
        'created_at'        => date('Y-m-d H:i:s'),
        'updated_at'        => date('Y-m-d H:i:s'),
    ]);
    return $id;
}
