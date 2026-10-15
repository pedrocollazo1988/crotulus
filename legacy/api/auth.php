<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  API DE AUTENTICACION  ->  /api/auth.php
 *  Acciones (?action=):
 *     register        POST  crear cuenta + enviar verificacion por correo
 *     login           POST  iniciar sesion (rate limit + regenerar id)
 *     logout          POST  cerrar sesion
 *     forgot          POST  enviar enlace para restablecer contrasena
 *     google_start    GET   redirige a Google
 *     google_callback GET   recibe el codigo de Google y crea la sesion
 *     me              GET   datos del usuario con sesion iniciada
 * ============================================================================
 */

require_once __DIR__ . '/../app/bootstrap.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

switch ($action) {

    /* --------------------------------------------------------------------- */
    case 'register':
        if ($method !== 'POST') json_error('Metodo no permitido.', 405);
        csrf_require();

        if (!rate_limit('register', 10, 3600)) {
            json_error('Demasiados intentos. Prueba más tarde.', 429);
        }

        $email = normalize_email(input('email'));
        $name  = clean_text(input('name'));
        $pass  = (string) (request_input()['password'] ?? '');

        $errors = [];
        if ($email === null) $errors['email'] = 'Escribe un correo válido.';
        $nameErrors = validate_name($name);
        if ($nameErrors) $errors['name'] = implode(' ', $nameErrors);
        $passErrors = validate_password($pass);
        if ($passErrors) $errors['password'] = implode(' ', $passErrors);
        if ($errors) json_error('Revisa los datos.', 422, ['fields' => $errors]);

        if (auth_find_by_email($email)) {
            json_error('Ya existe una cuenta con este correo.', 409);
        }

        $userId = auth_create_user($email, $name, $pass, 'pending');
        $user   = db_one('SELECT * FROM users WHERE id = ?', [$userId]);
        auth_send_verification($user);
        audit('user_registered', ['id' => $userId, 'email' => $email]);

        json_ok(['message' => 'Cuenta creada. Revisa tu correo para verificarla.']);
        // no break

    /* --------------------------------------------------------------------- */
    case 'login':
        if ($method !== 'POST') json_error('Metodo no permitido.', 405);
        csrf_require();

        if (!rate_limit('login', (int) config('security.login_rate_max', 10), (int) config('security.login_rate_window', 900))) {
            json_error('Demasiados intentos. Espera unos minutos.', 429);
        }

        $email = normalize_email(input('email'));
        $pass  = (string) (request_input()['password'] ?? '');

        // Validacion de formato antes de comprobar credenciales.
        $errors = [];
        if ($email === null) $errors['email'] = 'Escribe un correo válido.';
        if ($pass === '')    $errors['password'] = 'Escribe tu contraseña.';
        if ($errors) json_error('Revisa los datos.', 422, ['fields' => $errors]);

        $user  = auth_check_credentials($email, $pass);

        if (!$user) {
            audit('login_failed', ['email' => (string) $email, 'ip' => client_ip()]);
            json_error('Correo o contraseña incorrectos.', 401);
        }
        if ($user['status'] === 'pending' && $user['email_verified_at'] === null) {
            json_error('Tu cuenta aún no está verificada. Revisa tu correo.', 403);
        }
        if ($user['status'] === 'banned') {
            json_error('Esta cuenta está deshabilitada.', 403);
        }

        auth_login($user);
        audit('login_ok', ['id' => (int) $user['id']]);
        json_ok(['user' => public_user($user)]);
        // no break

    /* --------------------------------------------------------------------- */
    case 'logout':
        if ($method !== 'POST') json_error('Metodo no permitido.', 405);
        csrf_require();
        auth_logout();
        json_ok(['message' => 'Sesión cerrada.']);
        // no break

    /* --------------------------------------------------------------------- */
    case 'forgot':
        if ($method !== 'POST') json_error('Metodo no permitido.', 405);
        csrf_require();

        if (!rate_limit('forgot', 5, 3600)) {
            json_error('Demasiadas solicitudes. Prueba más tarde.', 429);
        }

        $email = normalize_email(input('email'));
        if ($email === null) {
            json_error('Escribe un correo válido.', 422, ['fields' => ['email' => 'Escribe un correo válido.']]);
        }
        $user  = auth_find_by_email($email);
        if ($user) {
            auth_send_password_reset($user);
        }
        // Respuesta identica exista o no la cuenta (evita enumerar usuarios).
        json_ok(['message' => 'Si el correo existe, recibirás un enlace para restablecerla.']);
        // no break

    /* --------------------------------------------------------------------- */
    case 'me':
        $user = current_user();
        if (!$user) json_error('No hay sesión iniciada.', 401);
        json_ok(['user' => public_user($user)]);
        // no break

    /* --------------------------------------------------------------------- */
    case 'google_start':
        // Si aún no hay credenciales, volvemos al acceso con un aviso claro
        // (el botón permanece visible y activo en la pantalla de login).
        if (!google_enabled()) {
            header('Location: ' . url('admin/login.php?status=google_off'));
            exit;
        }
        header('Location: ' . google_auth_url());
        exit;
        // no break

    /* --------------------------------------------------------------------- */
    case 'google_callback':
        if (!google_enabled()) json_error('El acceso con Google no está configurado.', 503);

        $state = (string) ($_GET['state'] ?? '');
        $code  = (string) ($_GET['code'] ?? '');
        if (empty($_SESSION['google_state']) || !hash_equals((string) $_SESSION['google_state'], $state)) {
            json_error('Solicitud de Google no válida (state).', 400);
        }
        unset($_SESSION['google_state']);
        if ($code === '') json_error('Google no devolvió el código de autorización.', 400);

        $accessToken = google_exchange_code($code);
        if (!$accessToken) json_error('No se pudo validar la sesión con Google.', 502);

        $info = google_userinfo($accessToken);
        if (!$info) json_error('No se pudieron obtener tus datos de Google.', 502);

        $userId = google_find_or_create($info);
        $user   = db_one('SELECT * FROM users WHERE id = ?', [$userId]);
        auth_login($user);
        audit('login_google', ['id' => $userId]);

        header('Location: ' . url('admin/'));
        exit;
        // no break

    /* --------------------------------------------------------------------- */
    default:
        json_error('Acción no reconocida.', 404);
}

/** Datos publicos del usuario (nunca el hash de contrasena). */
function public_user(array $u): array
{
    return [
        'id'     => (int) $u['id'],
        'email'  => $u['email'],
        'name'   => $u['name'],
        'role'   => $u['role'],
        'status' => $u['status'],
        'avatar' => $u['avatar_url'],
    ];
}
