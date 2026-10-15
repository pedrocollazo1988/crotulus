<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  PANEL DE ADMINISTRACIÓN
 *  - Inicio de sesión / registro / recuperación de contraseña
 *  - Bandeja de mensajes del formulario de contacto
 *  - Contenido editable (servicios, proyectos, testimonios, FAQ)
 *  - Ajustes del sitio (teléfono, correo, dirección, mapa, redes)
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
function admin_header(string $title, bool $nav = true, string $active = ''): void
{
    $site = e((string) config('site_name'));
    $user = current_user();
    echo "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\">"
        . "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
        . "<meta name=\"color-scheme\" content=\"light\">"
        . "<title>" . e($title) . " · Panel · $site</title>"
        . "<link rel=\"preload\" as=\"font\" type=\"font/woff2\" href=\"" . url('assets/fonts/PlusJakartaSans-latin.woff2') . "?v=" . APP_ASSET_VERSION . "\" crossorigin>"
        . "<link rel=\"preload\" as=\"font\" type=\"font/woff2\" href=\"" . url('assets/fonts/Inter-latin.woff2') . "?v=" . APP_ASSET_VERSION . "\" crossorigin>"
        . "<link rel=\"icon\" type=\"image/png\" href=\"" . url('assets/img/favicon.png') . "\">"
        . "<link rel=\"stylesheet\" href=\"" . url('admin/assets/admin.css') . "?v=" . APP_ASSET_VERSION . "\"></head><body>";

    if ($nav) {
        $u = e((string) ($user['name'] ?? $user['email'] ?? ''));
        $unread = (int) (db_one("SELECT COUNT(*) AS c FROM contact_messages WHERE status = 'nuevo'")['c'] ?? 0);
        $pending = (int) (db_one("SELECT COUNT(*) AS c FROM users WHERE status = 'pending'")['c'] ?? 0);
        $pendingReviews = (int) (db_one("SELECT COUNT(*) AS c FROM reviews WHERE status = 'pendiente'")['c'] ?? 0);
        $pendingSubs = (int) (db_one("SELECT COUNT(*) AS c FROM user_submissions WHERE status = 'pendiente'")['c'] ?? 0);
        $counts = ['Mensajes' => $unread, 'Usuarios' => $pending, 'Valoraciones' => $pendingReviews, 'Aportaciones' => $pendingSubs];
        $links  = [
            'Mi cuenta' => ['admin/account.php', 'Mi cuenta'],
        ];
        // Las secciones de gestión solo tienen sentido para administradores.
        if (is_admin()) {
            $links += [
                'Mensajes' => ['admin/index.php', 'Mensajes'],
                'Contenido' => ['admin/content.php', 'Contenido'],
                'Blog' => ['admin/blog.php', 'Blog'],
                'Equipo' => ['admin/team.php', 'Equipo'],
                'Valoraciones' => ['admin/reviews.php', 'Valoraciones'],
                'Aportaciones' => ['admin/submissions.php', 'Aportaciones'],
                'Ajustes' => ['admin/settings.php', 'Ajustes'],
                'Usuarios' => ['admin/users.php', 'Usuarios'],
            ];
        }
        $items = '';
        foreach ($links as $key => [$href, $label]) {
            $cls = $active === $key ? ' class="is-active"' : '';
            $badge = '';
            if (!empty($counts[$key])) {
                $badge = '<span class="nav-badge__count">' . (int) $counts[$key] . '</span>';
            }
            $items .= "<a$cls href=\"" . url($href) . "\">$label$badge</a>";
        }

        $logo = url('assets/img/logo-header.png') . "?v=" . APP_ASSET_VERSION;
        echo "<header class=\"topbar\"><a class=\"brand\" href=\"" . url('admin/') . "\">"
            . "<img class=\"brand__logo\" src=\"$logo\" alt=\"" . e((string) config('site_name')) . "\">"
            . "</a>"
            . "<nav class=\"topnav\" aria-label=\"Navegación del panel\">$items"
            . "<a href=\"" . url('index.html') . "\" target=\"_blank\" rel=\"noopener\">Ver sitio</a>"
            . "<span class=\"who\">$u</span>"
            . "<form method=\"post\" action=\"" . url('admin/logout.php') . "\" class=\"inline\">"
            . "<input type=\"hidden\" name=\"_csrf\" value=\"" . e(csrf_token()) . "\">"
            . "<button class=\"btn-link\" type=\"submit\">Salir</button>"
            . "</form></nav></header>";
    }
    echo "<main class=\"wrap\">";
}

/**
 * Pagina de autenticacion con la identidad de la web: panel de marca a la
 * izquierda y formulario en una tarjeta a la derecha.
 *
 * @param string $title   Titulo de la pestana y del formulario.
 * @param string $bullets Lista (<li>) de ventajas mostrada en el panel de marca.
 */
function admin_auth_page(string $title, string $bulletsHtml): void
{
    $site   = e((string) config('site_name'));
    $v      = APP_ASSET_VERSION;
    $logo   = url('assets/img/logo-header.png') . "?v=$v";
    $home   = url('index.html');

    echo "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\">"
        . "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
        . "<meta name=\"color-scheme\" content=\"light\">"
        . "<title>" . e($title) . " · $site</title>"
        . "<link rel=\"preload\" as=\"font\" type=\"font/woff2\" href=\"" . url('assets/fonts/PlusJakartaSans-latin.woff2') . "?v=" . APP_ASSET_VERSION . "\" crossorigin>"
        . "<link rel=\"preload\" as=\"font\" type=\"font/woff2\" href=\"" . url('assets/fonts/Inter-latin.woff2') . "?v=" . APP_ASSET_VERSION . "\" crossorigin>"
        . "<link rel=\"icon\" type=\"image/png\" href=\"" . url('assets/img/favicon.png') . "\">"
        . "<link rel=\"stylesheet\" href=\"" . url('admin/assets/admin.css') . "?v=$v\"></head><body>"
        . "<div class=\"auth-page\">"
        . "<aside class=\"auth-aside\"><div class=\"auth-aside__inner\">"
        . "<a class=\"auth-aside__logo\" href=\"$home\"><img src=\"$logo\" alt=\"$site\"></a>"
        . "<h2>Tecnología clara<br>que hace crecer tu negocio</h2>"
        . "<p>Área privada de C-ROTULUS para gestionar el contenido del sitio y los mensajes de tus clientes.</p>"
        . "<ul>$bulletsHtml</ul>"
        . "<p class=\"auth-aside__back\"><a href=\"$home\">&larr; Volver a la web</a></p>"
        . "</div></aside>"
        . "<main class=\"auth-main\"><div class=\"auth-card\">"
        . "<div class=\"auth-brand-mobile\"><img src=\"" . url('assets/img/logo-header.png') . "?v=$v\" alt=\"$site\"></div>";
}

/** Cierra la pagina de autenticacion (incluye el JS de validacion). */
function admin_auth_footer(): void
{
    echo "</div></main></div>"
        . "<script src=\"" . url('admin/assets/admin-auth.js') . "?v=" . APP_ASSET_VERSION . "\" defer></script>"
        . "</body></html>";
}

/** Enlace de error bajo un campo, para el JS de validacion. */
function field_error_span(string $for): string
{
    return '<span class="field__hint" data-error-for="' . e($for) . '" hidden></span>';
}

/** Pie del panel. */
function admin_footer(): void
{
    echo "</main><footer class=\"foot\">&copy; " . date('Y') . " "
        . e((string) config('site_name'))
        . " &middot; <a href=\"" . url('index.html') . "\">Volver a la web</a></footer></body></html>";
}
