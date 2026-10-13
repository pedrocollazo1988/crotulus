<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  API PUBLICA
 *  GET /api/index.php
 *      ?resource=settings  -> datos editables del sitio (telefono, mapa, etc.)
 *      ?resource=content   -> contenido editable (servicios, proyectos, faq...)
 *      ?resource=reviews   -> valoraciones publicadas (media y últimas reseñas)
 *      ?resource=trustpilot -> reseñas reales de la ficha de Trustpilot (API publica)
 *      ?resource=faqs      -> preguntas frecuentes ordenadas por importancia
 *      ?resource=testimonials -> testimonios publicados por usuarios registrados
 *      ?resource=session   -> si hay sesión iniciada y sus aportaciones
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

    case 'reviews':
        if (!reviews_enabled()) {
            json_ok(['enabled' => false, 'summary' => ['total' => 0, 'average' => 0, 'stars' => 0], 'items' => []]);
        }
        $type  = isset($_GET['type']) ? clean_text((string) $_GET['type']) : '';
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 12;
        json_ok([
            'enabled' => true,
            'summary' => reviews_summary($type !== '' ? $type : null),
            'items'   => reviews_published($type, $limit),
        ]);
        // no break;

    case 'trustpilot':
        json_ok(trustpilot_fetch());
        // no break;

    /* --- Preguntas frecuentes ordenadas por importancia (algoritmo) -------- */
    case 'faqs':
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : (int) setting('faq_portal_count', '6');
        json_ok([
            'items'    => faqs_top($limit),
            'settings' => [
                'submissions_enabled' => submissions_enabled(),
            ],
        ]);
        // no break;

    /* --- Testimonios publicados por usuarios registrados ------------------- */
    case 'testimonials':
        $items = [];
        foreach (testimonials_published(12) as $t) {
            $items[] = [
                'author_name' => (string) $t['title'],
                'comment'     => (string) $t['body'],
                'photo'       => (string) ($t['avatar_url'] ?? ''),
                'created_at'  => (string) $t['created_at'],
                'source'      => 'usuario',
            ];
        }
        json_ok(['items' => $items]);
        // no break;

    /* --- Estado de la sesión (para saber si el usuario puede aportar) ------- */
    case 'session':
        $user = current_user();
        if (!$user) {
            json_ok(['logged_in' => false]);
        }
        json_ok([
            'logged_in' => true,
            'user'      => [
                'id'   => (int) $user['id'],
                'name' => (string) $user['name'],
            ],
            'submissions' => submissions_for_user((int) $user['id'], 10),
            'settings'    => [
                'submissions_enabled' => submissions_enabled(),
            ],
        ]);
        // no break;

    default:
        json_error('Recurso no encontrado.', 404);
}
