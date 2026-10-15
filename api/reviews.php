<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  API DE VALORACIONES  ->  POST /api/reviews.php
 *  Recibe la valoración de un servicio o proyecto (1-5 estrellas + comentario).
 *  Seguridad: token CSRF, límite por IP, campo trampa (honeypot) y validación.
 *  Respeta el ajuste "reviews_auto_approve": si está a 0, la reseña queda
 *  "pendiente" hasta que el administrador la apruebe en el panel.
 *  Devuelve siempre JSON.
 * ============================================================================
 */

require_once __DIR__ . '/../app/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    json_error('Metodo no permitido.', 405);
}

if (!reviews_enabled()) {
    json_error('Las valoraciones están desactivadas.', 503);
}

/* --- 0. Abierto a cualquier visitante ------------------------------------ */
// Cualquier persona puede valorar servicios y proyectos: no requiere cuenta.
// Si hay sesión iniciada, asociamos la valoración a esa cuenta (0 = anónimo).
$user = current_user();
$userId = $user ? (int) $user['id'] : 0;

/* --- 1. Anti-CSRF --------------------------------------------------------- */
csrf_require();

/* --- 2. Límite de envíos por IP ------------------------------------------ */
$max    = (int) config('security.review_rate_max', 6);
$window = (int) config('security.review_rate_window', 3600);
if (!rate_limit('review', $max, $window)) {
    json_error('Has enviado demasiadas valoraciones. Inténtalo de nuevo más tarde.', 429);
}
rate_limit_gc();

/* --- 3. Campo trampa: si viene relleno, es un bot ------------------------- */
if (input('_gotcha') !== '') {
    json_ok(['message' => '¡Gracias por tu valoración!']);
}

/* --- 4. Validación -------------------------------------------------------- */
$result = validate_review(request_input());
if (!empty($result['errors'])) {
    json_error('Revisa los campos marcados.', 422, ['fields' => $result['errors']]);
}
$data = $result['data'];

/* --- 5. Guardado ---------------------------------------------------------- */
$status = reviews_auto_approve() ? 'aprobada' : 'pendiente';
$id = db_insert('reviews', [
    'target_type'  => $data['target_type'],
    'target_id'    => $data['target_id'],
    'target_label' => $data['target_label'],
    'rating'       => $data['rating'],
    'author_name'  => $data['author_name'],
    'author_email' => $data['author_email'],
    'comment'      => $data['comment'],
    'user_id'      => $userId,
    'status'       => $status,
    'ip'           => client_ip(),
    'user_agent'   => mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
    'created_at'   => date('Y-m-d H:i:s'),
]);

audit('review_created', ['id' => $id, 'rating' => $data['rating'], 'type' => $data['target_type']]);

/* --- 6. Aviso por correo al administrador (no bloquea la respuesta) ------- */
$html = mailer_template('Nueva valoración recibida', "
    <p><strong>Puntuación:</strong> {$data['rating']} / 5</p>
    <p><strong>Tipo:</strong> " . e($data['target_type']) . "</p>
    <p><strong>Elemento:</strong> " . e($data['target_label']) . "</p>
    <p><strong>Autor:</strong> " . e($data['author_name']) . " (" . e($data['author_email']) . ")</p>
    <p><strong>Comentario:</strong></p><p>" . nl2br(e($data['comment'])) . "</p>
    <p><em>Estado: $status.</em></p>
");
$notify = mail_notify_to();
if (filter_var($notify, FILTER_VALIDATE_EMAIL)) {
    @send_mail($notify, 'Nueva valoración · ' . config('site_name'), $html);
}

/* --- 7. Respuesta --------------------------------------------------------- */
$message = $status === 'aprobada'
    ? '¡Gracias por tu valoración! Ya está publicada.'
    : '¡Gracias por tu valoración! Se publicará tras una breve revisión.';

json_ok(['message' => $message, 'status' => $status]);
