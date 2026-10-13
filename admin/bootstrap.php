<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  PANEL DE ADMINISTRACION
 *  - Inicio de sesion / registro / recuperacion de contrasena
 *  - Bandeja de mensajes del formulario de contacto
 *  - Contenido editable (servicios, proyectos, testimonios, FAQ)
 *  - Ajustes del sitio (telefono, correo, direccion, mapa, redes)
 * ============================================================================
 */

require_once __DIR__ . '/../app/bootstrap.php';

// Evita que este archivo se pueda ejecutar directamente por URL.
if (basename((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === 'bootstrap.php') {
    http_response_code(404);
    exit;
}

/* --- Token CSRF para los formularios del panel ---------------------------- */
$csrf = csrf_token();

/** Cabecera del panel. */
function admin_header(string $title, bool $nav = true): void
{
    $site = e((string) config('site_name'));
    $user = current_user();
    echo "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\">"
        . "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
        . "<title>" . e($title) . " · Panel · $site</title>"
        . "<link rel=\"stylesheet\" href=\"" . url('admin/assets/admin.css') . "\"></head><body>";

    if ($nav) {
        $u = e((string) ($user['name'] ?? $user['email'] ?? ''));
        echo "<header class=\"topbar\"><a class=\"brand\" href=\"" . url('admin/') . "\">$site · Panel</a>"
            . "<nav class=\"topnav\">"
            . "<a href=\"" . url('admin/index.php') . "\">Mensajes</a>"
            . "<a href=\"" . url('admin/content.php') . "\">Contenido</a>"
            . "<a href=\"" . url('admin/settings.php') . "\">Ajustes</a>"
            . "<span class=\"who\">$u</span>"
            . "<form method=\"post\" action=\"" . url('admin/logout.php') . "\" class=\"inline\">"
            . "<input type=\"hidden\" name=\"_csrf\" value=\"" . e(csrf_token()) . "\">"
            . "<button class=\"btn-link\" type=\"submit\">Salir</button>"
            . "</form></nav></header>";
    }
    echo "<main class=\"wrap\">";
}

/** Pie del panel. */
function admin_footer(): void
{
    echo "</main><footer class=\"foot\">&copy; " . date('Y') . " " . e((string) config('site_name')) . "</footer></body></html>";
}
