<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  API DE APORTACIONES  ->  POST /api/submissions.php
 *  ----------------------------------------------------------------------------
 *  Requiere sesión iniciada. Permite enviar:
 *    - tipo=testimonio  (nombre + experiencia)  -> se publica al aprobarse.
 *    - tipo=pregunta    (pregunta + detalle)     -> alimenta las FAQ y su
 *                                                   algoritmo de importancia.
 *  La aportación queda asociada a la cuenta que la envía. Los formularios
 *  viven en el área privada (admin/account.php).
 *  Seguridad: sesión obligatoria, CSRF, límite por IP, honeypot y validación.
 *  Respeta el ajuste "submissions_auto_approve".
 * ============================================================================
 */

require_once __DIR__ . '/../app/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    json_error('Metodo no permitido.', 405);
}

if (!submissions_enabled()) {
    json_error('Las aportaciones están desactivadas.', 503);
}

/* --- 0. Sesión obligatoria ----------------------------------------------- */
$user   = require_user();
$userId = (int) $user['id'];

/* --- 1. Anti-CSRF --------------------------------------------------------- */
csrf_require();

/* --- 2. Límite de envíos por IP ------------------------------------------ */
$max    = (int) config('security.submission_rate_max', 8);
$window = (int) config('security.submission_rate_window', 3600);
if (!rate_limit('submission', $max, $window)) {
    json_error('Has enviado demasiadas aportaciones. Inténtalo de nuevo más tarde.', 429);
}
rate_limit_gc();

/* --- 3. Campo trampa ------------------------------------------------------ */
if (input('_gotcha') !== '') {
    json_ok(['message' => '¡Gracias por tu aportación!']);
}

/* --- 4. Validación -------------------------------------------------------- */
$result = validate_submission(request_input());
if (!empty($result['errors'])) {
    json_error('Revisa los campos marcados.', 422, ['fields' => $result['errors']]);
}
$data = $result['data'];

/* --- 5. Guardado ---------------------------------------------------------- */
$status = submissions_auto_approve() ? 'aprobada' : 'pendiente';
$id = db_insert('user_submissions', [
    'user_id'    => $userId,
    'stype'      => $data['stype'],
    'title'      => $data['title'],
    'body'       => $data['body'],
    'status'     => $status,
    'ip'         => client_ip(),
    'created_at' => date('Y-m-d H:i:s'),
    'updated_at' => date('Y-m-d H:i:s'),
]);

audit('submission_created', ['id' => $id, 'type' => $data['stype'], 'user' => $userId]);

/* --- 6. Aviso por correo (no bloquea la respuesta) ------------------------ */
$tipo  = submission_type_label($data['stype']);
$autor = (string) ($user['name'] ?: $user['email']);
$html = mailer_template("Nueva aportación: $tipo", "
    <p><strong>Tipo:</strong> " . e($tipo) . "</p>
    <p><strong>Autor:</strong> " . e($autor) . "</p>
    <p><strong>Título:</strong> " . e($data['title']) . "</p>
    <p><strong>Detalle:</strong></p><p>" . nl2br(e($data['body'])) . "</p>
    <p><em>Estado: $status.</em></p>
");
$notify = mail_notify_to();
if (filter_var($notify, FILTER_VALIDATE_EMAIL)) {
    @send_mail($notify, "Nueva aportación · " . config('site_name'), $html);
}

/* --- 7. Respuesta --------------------------------------------------------- */
$message = $status === 'aprobada'
    ? '¡Gracias! Tu aportación ya está publicada.'
    : '¡Gracias! Tu aportación se revisará antes de publicarse.';

json_ok(['message' => $message, 'status' => $status]);
