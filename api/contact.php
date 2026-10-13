<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  API DE CONTACTO  ->  POST /api/contact.php
 *  Seguridad: token CSRF, limite de envios por IP, campo trampa (honeypot),
 *  validacion y saneamiento, y guardado en base de datos.
 *  Devuelve siempre JSON.
 * ============================================================================
 */

require_once __DIR__ . '/../app/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    json_error('Metodo no permitido.', 405);
}

/* --- 1. Anti-CSRF --------------------------------------------------------- */
csrf_require();

/* --- 2. Limite de envios por IP ------------------------------------------ */
$max    = (int) config('security.contact_rate_max', 5);
$window = (int) config('security.contact_rate_window', 3600);
if (!rate_limit('contact', $max, $window)) {
    json_error('Has enviado demasiados mensajes. Inténtalo de nuevo más tarde.', 429);
}
rate_limit_gc();

/* --- 3. Campo trampa: si viene relleno, es un bot ------------------------- */
if (input('_gotcha') !== '') {
    // Respondemos como exito para no dar pistas al bot, pero no guardamos nada.
    json_ok(['message' => 'Gracias, hemos recibido tu mensaje.']);
}

/* --- 4. Validacion -------------------------------------------------------- */
$result = validate_contact(request_input());
if (!empty($result['errors'])) {
    json_error('Revisa los campos marcados.', 422, ['fields' => $result['errors']]);
}
$data = $result['data'];

/* --- 5. Guardado ---------------------------------------------------------- */
$id = db_insert('contact_messages', [
    'name'       => $data['name'],
    'email'      => $data['email'],
    'phone'      => $data['phone'],
    'service'    => $data['service'],
    'message'    => $data['message'],
    'status'     => 'nuevo',
    'ip'         => client_ip(),
    'user_agent' => mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
    'created_at' => date('Y-m-d H:i:s'),
]);

audit('contact_message', ['id' => $id, 'email' => $data['email']]);

/* --- 6. Aviso por correo (no bloquea la respuesta si falla) --------------- */
$html = mailer_template('Nuevo mensaje de contacto', "
    <p><strong>Nombre:</strong> " . e($data['name']) . "</p>
    <p><strong>Correo:</strong> " . e($data['email']) . "</p>
    <p><strong>Teléfono:</strong> " . e($data['phone']) . "</p>
    <p><strong>Servicio:</strong> " . e($data['service']) . "</p>
    <p><strong>Mensaje:</strong></p>
    <p>" . nl2br(e($data['message'])) . "</p>
");
$notify = (string) setting('correo', config('defaults.correo'));
if (filter_var($notify, FILTER_VALIDATE_EMAIL)) {
    @send_mail($notify, 'Nuevo mensaje de contacto · ' . config('site_name'), $html);
}

/* --- 7. Respuesta --------------------------------------------------------- */
json_ok(['message' => 'Gracias, hemos recibido tu mensaje. Te responderemos en breve.']);
