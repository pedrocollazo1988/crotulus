<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  AJUSTES DEL SITIO
 *  Clave/valor en la tabla "settings"; los usa el panel y la API publica.
 * ============================================================================
 */

/** Devuelve todos los ajustes como array asociativo. */
function settings_all(): array
{
    $rows = db_all('SELECT skey, svalue FROM settings');
    $out  = [];
    foreach ($rows as $row) {
        $out[$row['skey']] = $row['svalue'];
    }
    // Rellena con los valores por defecto que falten.
    $all = array_merge(config('defaults') ?? [], $out);
    // site_name y site_url viven en la config superior; se exponen aquí para
    // que el panel los muestre y la API pública los entregue.
    $all['site_name'] = $out['site_name'] ?? (string) config('site_name', '');
    $all['site_url']  = $out['site_url'] ?? (string) config('site_url', '');
    return $all;
}

/** Devuelve un ajuste concreto. */
function setting(string $key, $default = ''): string
{
    $row = db_one('SELECT svalue FROM settings WHERE skey = ?', [$key]);
    if ($row) {
        return (string) $row['svalue'];
    }
    return (string) (config('defaults.' . $key, $default));
}

/** Guarda (o crea) un ajuste. */
function setting_set(string $key, string $value): void
{
    $exists = db_one('SELECT skey FROM settings WHERE skey = ?', [$key]);
    if ($exists) {
        db_update('settings', ['svalue' => $value, 'updated_at' => date('Y-m-d H:i:s')], 'skey = :skey', ['skey' => $key]);
    } else {
        db_insert('settings', ['skey' => $key, 'svalue' => $value, 'updated_at' => date('Y-m-d H:i:s')]);
    }
}

/** Ajustes que se pueden editar desde el panel (lista blanca). */
function settings_editable(): array
{
    return [
        // Contacto y redes
        'telefono', 'whatsapp', 'correo', 'direccion', 'ciudad', 'horario',
        'mapa_embed', 'google_maps_url',
        'facebook', 'instagram', 'linkedin', 'github',
        // Valoraciones y reseñas
        'reviews_enabled', 'reviews_auto_approve', 'reviews_provider',
        'trustpilot_url', 'trustpilot_business_id', 'trustpilot_template',
        'google_reviews_url',
        // Aportaciones de usuarios y FAQ
        'submissions_enabled', 'submissions_auto_approve', 'faq_portal_count',
        // Identidad del sitio (SEO y avisos por correo)
        'site_name', 'site_url', 'meta_description', 'meta_keywords',
        'og_image',
        // Correo saliente (SMTP / mail() / log)
        'mail_transport', 'mail_from_email', 'mail_from_name',
        'mail_smtp_host', 'mail_smtp_port', 'mail_smtp_user', 'mail_smtp_pass',
        'mail_smtp_secure',
        // Seguridad y limitación de envíos
        'security_password_min', 'security_session_lifetime',
        'security_contact_rate_max', 'security_contact_rate_window',
        'security_login_rate_max', 'security_login_rate_window',
        'security_review_rate_max', 'security_review_rate_window',
        'security_submission_rate_max', 'security_submission_rate_window',
        'security_session_bind_ip',
        // Integraciones (OAuth)
        'google_client_id', 'google_client_secret', 'google_redirect_uri',
        // Rutas y mantenimiento
        'paths_log_dir', 'maintenance_mode', 'maintenance_message',
    ];
}

/** Casillas de verificación: se guardan siempre como '1' o '0'. */
function settings_checkboxes(): array
{
    return [
        'reviews_enabled', 'reviews_auto_approve',
        'submissions_enabled', 'submissions_auto_approve',
        'security_session_bind_ip', 'maintenance_mode',
    ];
}

/** Claves sensibles: se guardan pero se muestran enmascaradas en el panel. */
function settings_secret_keys(): array
{
    return ['google_client_secret', 'mail_smtp_pass'];
}

/**
 * Claves que NUNCA se exponen en la API pública (secretos y datos internos).
 */
function settings_private_keys(): array
{
    return settings_secret_keys();
}

/* ---------------------------------------------------------------------------
 *  INTEGRACIÓN DE LOS AJUSTES CON config.php
 *  Los ajustes guardados en la base de datos tienen prioridad sobre
 *  app/config.php. Así el panel puede cambiar correo, seguridad, etc. sin
 *  editar ficheros. Se aplica al arrancar (ver app/bootstrap.php).
 * ------------------------------------------------------------------------- */

/** Mapa: clave de "settings" -> ruta de config ("a.b" o "a.b.c"). */
function settings_config_map(): array
{
    return [
        'site_name'   => 'site_name',
        'site_url'    => 'site_url',

        'mail_transport'   => 'mail.transport',
        'mail_from_email'  => 'mail.from_email',
        'mail_from_name'   => 'mail.from_name',
        'mail_smtp_host'   => 'mail.smtp_host',
        'mail_smtp_port'   => 'mail.smtp_port',
        'mail_smtp_user'   => 'mail.smtp_user',
        'mail_smtp_pass'   => 'mail.smtp_pass',
        'mail_smtp_secure' => 'mail.smtp_secure',

        'security_password_min'            => 'security.password_min',
        'security_session_lifetime'        => 'security.session_lifetime',
        'security_session_bind_ip'         => 'security.session_bind_ip',
        'security_contact_rate_max'        => 'security.contact_rate_max',
        'security_contact_rate_window'     => 'security.contact_rate_window',
        'security_login_rate_max'          => 'security.login_rate_max',
        'security_login_rate_window'       => 'security.login_rate_window',
        'security_review_rate_max'         => 'security.review_rate_max',
        'security_review_rate_window'      => 'security.review_rate_window',
        'security_submission_rate_max'     => 'security.submission_rate_max',
        'security_submission_rate_window'  => 'security.submission_rate_window',

        'google_client_id'     => 'google.client_id',
        'google_client_secret' => 'google.client_secret',
        'google_redirect_uri'  => 'google.redirect_uri',

        'paths_log_dir' => 'paths.log_dir',
    ];
}

/** Escribe un valor dentro de $config usando la ruta "a.b". */
function config_set_path(array &$config, string $path, $value): void
{
    $parts = explode('.', $path);
    $ref = &$config;
    foreach ($parts as $i => $part) {
        if ($i === count($parts) - 1) {
            $ref[$part] = $value;
            return;
        }
        if (!isset($ref[$part]) || !is_array($ref[$part])) {
            $ref[$part] = [];
        }
        $ref = &$ref[$part];
    }
}

/**
 * Sobrescribe la configuración con los valores guardados en la base de datos.
 * Se llama una sola vez durante el arranque (bootstrap).
 */
function settings_apply_overrides(array &$config): void
{
    if (!function_exists('db_all')) {
        return;
    }
    try {
        $rows = db_all('SELECT skey, svalue FROM settings');
    } catch (Throwable $e) {
        return; // Sin tabla de ajustes todavía: seguimos con config.php.
    }
    $map = settings_config_map();
    $castInt = [
        'mail.smtp_port',
        'security.password_min', 'security.session_lifetime',
        'security.contact_rate_max', 'security.contact_rate_window',
        'security.login_rate_max', 'security.login_rate_window',
        'security.review_rate_max', 'security.review_rate_window',
        'security.submission_rate_max', 'security.submission_rate_window',
    ];
    foreach ($rows as $row) {
        $key = (string) $row['skey'];
        if (!isset($map[$key])) {
            continue;
        }
        $path  = $map[$key];
        $value = (string) $row['svalue'];

        if ($path === 'security.session_bind_ip') {
            config_set_path($config, $path, $value === '1');
        } elseif (in_array($path, $castInt, true)) {
            config_set_path($config, $path, (int) $value);
        } else {
            config_set_path($config, $path, $value);
        }
    }
}

/** Datos publicos que expone la web (subconjunto seguro de ajustes). */
function settings_public(): array
{
    // Lista blanca: solo lo que el front-end necesita. Nunca credenciales,
    // ajustes de seguridad ni rutas internas del servidor.
    $allow = [
        'telefono', 'whatsapp', 'correo', 'direccion', 'ciudad', 'horario',
        'mapa_embed', 'google_maps_url',
        'facebook', 'instagram', 'linkedin', 'github',
        'reviews_enabled', 'reviews_auto_approve', 'reviews_provider',
        'trustpilot_url', 'trustpilot_business_id', 'trustpilot_template',
        'google_reviews_url',
        'submissions_enabled', 'submissions_auto_approve', 'faq_portal_count',
        'site_name', 'site_url', 'meta_description',
        'maintenance_mode', 'maintenance_message',
    ];
    $all = settings_all();
    $out = [];
    foreach ($allow as $key) {
        if (array_key_exists($key, $all)) {
            $out[$key] = $all[$key];
        }
    }
    return $out;
}
