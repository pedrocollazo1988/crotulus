<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  API PUBLICA
 *  GET /api/index.php
 *      ?resource=settings  -> datos editables del sitio (telefono, mapa, etc.)
 *      ?resource=content   -> contenido editable (servicios, proyectos, faq...)
 *  GET /api/index.php?action=csrf -> entrega un token CSRF y lo guarda en sesion
 *
 *  La web estatica consume estos datos. Si el backend no responde, la web
 *  sigue mostrandose con sus valores por defecto.
 * ============================================================================
 */

require_once __DIR__ . '/../app/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET') {
    json_error('Metodo no permitido.', 405);
}

$resource = $_GET['resource'] ?? 'settings';
$action   = $_GET['action'] ?? '';

/* --- Token CSRF para el formulario de contacto ---------------------------- */
if ($action === 'csrf') {
    json_ok(['csrf_token' => csrf_token()]);
}

switch ($resource) {

    case 'settings':
        $data = settings_public();
        $data['site_name'] = config('site_name');
        json_ok(['settings' => $data]);
        // no break

    case 'content':
        $type = isset($_GET['type']) ? clean_text((string) $_GET['type']) : null;
        if ($type) {
            $rows = db_all(
                'SELECT id, ctype, title, subtitle, body, meta, sort_order FROM content_items
                 WHERE ctype = ? AND is_active = 1 ORDER BY sort_order ASC, id ASC',
                [$type]
            );
        } else {
            $rows = db_all(
                'SELECT id, ctype, title, subtitle, body, meta, sort_order FROM content_items
                 WHERE is_active = 1 ORDER BY ctype ASC, sort_order ASC, id ASC'
            );
        }
        foreach ($rows as &$row) {
            $row['meta'] = $row['meta'] ? json_decode((string) $row['meta'], true) : null;
        }
        unset($row);
        json_ok(['items' => $rows]);
        // no break

    case 'health':
        json_ok(['status' => 'ok', 'driver' => db_driver()]);
        // no break;

    default:
        json_error('Recurso no encontrado.', 404);
}
