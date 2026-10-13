<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  CONFIGURACION DE C-ROTULUS
 * ----------------------------------------------------------------------------
 *  Edita este archivo al subir el sitio a tu hosting.
 *  Consejo: copia este archivo como "config.local.php" y edita ahi los datos
 *  reales. Asi no pierdes tus cambios al actualizar el proyecto.
 * ============================================================================
 */

return [

    /* --- Identidad del sitio ------------------------------------------------ */
    'site_name' => 'C-ROTULUS S.U.R.L.',
    'site_url'  => 'https://www.c-rotulus.com',   // sin barra final
    'timezone'  => 'Europe/Madrid',

    /* --- Base de datos ------------------------------------------------------
       Elige 'mysql' en el hosting (recomendado) y rellena los datos que te
       da tu proveedor. Usa 'sqlite' para pruebas locales (no necesita nada). */
    'db' => [
        'driver'      => 'mysql',                 // mysql | sqlite
        'host'        => 'localhost',
        'port'        => 3306,
        'name'        => 'crotulus',
        'user'        => 'crotulus_user',
        'password'    => '[CONTRASENA_BD]',
        'charset'     => 'utf8mb4',
        'sqlite_path' => __DIR__ . '/data/c-rotulus.sqlite',
    ],

    /* --- Correo (verificacion de cuenta y recuperar contrasena) ------------
       'transport' => 'mail'  usa la funcion mail() del hosting (sencillo).
       'transport' => 'smtp'  usa tu servidor SMTP (mas fiable, recomendado).
       'transport' => 'log'   no envia, escribe en app/data/mail.log (pruebas). */
    'mail' => [
        'transport'   => 'log',
        'from_email'  => 'no-reply@c-rotulus.com',
        'from_name'   => 'C-ROTULUS',
        'smtp_host'   => 'smtp.tuproveedor.com',
        'smtp_port'   => 587,
        'smtp_user'   => '',
        'smtp_pass'   => '',
        'smtp_secure' => 'tls',                   // tls | ssl
    ],

    /* --- Inicio de sesion con Google (OAuth 2.0) ---------------------------
       Crea las credenciales en https://console.cloud.google.com/apis/credentials
       URI de redireccion autorizada:
           {site_url}/api/auth.php?action=google_callback
       Deja client_id vacio para desactivar el boton de Google. */
    'google' => [
        'client_id'     => '',
        'client_secret' => '',
        'redirect_uri'  => '',                    // vacio = se calcula solo
    ],

    /* --- Seguridad ---------------------------------------------------------- */
    'security' => [
        // Cambiala por una cadena larga y aleatoria (32+ caracteres).
        'app_key'             => 'cambia-esta-clave-por-una-larga-y-aleatoria-000',
        'session_name'        => 'crotulus_sid',
        'session_lifetime'    => 60 * 60 * 24 * 30, // 30 dias
        'contact_rate_max'    => 5,                 // max. envios de contacto...
        'contact_rate_window' => 3600,              // ...por hora y por IP
        'login_rate_max'      => 10,                // max. intentos de login...
        'login_rate_window'   => 900,               // ...por 15 minutos y por IP
        'password_min'        => 8,
        // Solo si tu hosting va detras de un proxy/CDN de confianza.
        // Ejemplo con Cloudflare: ['173.245.48.0/20', ...] o la IP del balanceador.
        'trusted_proxies'     => [],
    ],

    /* --- Datos editables del sitio (valores iniciales) ---------------------
       Se pueden cambiar despues desde el panel de administracion (se guardan
       en la tabla "settings"). Los marcadores [ ] son de ejemplo. */
    'defaults' => [
        'telefono'    => '[TELÉFONO]',
        'whatsapp'    => '34000000000',
        'correo'      => 'info@c-rotulus.example',
        'direccion'   => '[DIRECCIÓN]',
        'ciudad'      => '[CIUDAD]',
        'horario'     => 'Lunes a viernes, 9:00 - 18:00',
        // URL de incrustacion de Google Maps (ver README, apartado "Mapa").
        'mapa_embed'  => '',
        'google_maps_url' => 'https://www.google.com/maps',
        'facebook'    => '[URL_FACEBOOK]',
        'instagram'   => '[URL_INSTAGRAM]',
        'linkedin'    => '[URL_LINKEDIN]',
        'github'      => '[URL_GITHUB]',
    ],
];
