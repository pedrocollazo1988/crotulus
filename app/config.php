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
        'review_rate_max'     => 6,                 // max. valoraciones enviadas...
        'review_rate_window'  => 3600,              // ...por hora y por IP
        'submission_rate_max' => 8,                 // max. testimonios/preguntas...
        'submission_rate_window' => 3600,           // ...por hora y por IP
        'password_min'        => 8,
        'password_max'        => 200,
        // Vincula la sesion a la IP del visitante. Dejalo en false si el sitio
        // esta detras de un balanceador/CDN o de una plataforma con varias IPs
        // de salida (la IP cambia entre peticiones y cerraria la sesion). Ponlo
        // a true solo en un hosting simple de una sola maquina.
        'session_bind_ip'     => false,
        // Solo si tu hosting va detras de un proxy/CDN de confianza.
        // Ejemplo con Cloudflare: ['173.245.48.0/20', ...] o la IP del balanceador.
        'trusted_proxies'     => [],
    ],

    /* --- Datos editables del sitio (valores iniciales) ---------------------
       Se pueden cambiar despues desde el panel de administracion (se guardan
       en la tabla "settings"). Los marcadores [ ] son de ejemplo. */
    'defaults' => [
        // --- Identidad y SEO ----------------------------------------------
        // (site_name y site_url viven en la config superior y se pueden
        //  cambiar desde el panel; aquí solo los textos de SEO.)
        'meta_description'  => 'Servicios tecnológicos para pymes y autónomos: desarrollo web, automatización e IA, redes, soporte y mantenimiento.',
        'meta_keywords'     => 'servicios tecnológicos, desarrollo web, automatización, inteligencia artificial, soporte técnico, redes, pymes',
        'og_image'          => 'assets/img/og-image.jpg',

        // --- Contacto y redes ---------------------------------------------
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

        // --- Correo saliente (editable desde el panel) --------------------
        'mail_transport'   => 'log',
        'mail_from_email'  => 'no-reply@c-rotulus.com',
        'mail_from_name'   => 'C-ROTULUS',
        'mail_smtp_host'   => '',
        'mail_smtp_port'   => '587',
        'mail_smtp_user'   => '',
        'mail_smtp_pass'   => '',
        'mail_smtp_secure' => 'tls',

        // --- Seguridad (editable desde el panel) --------------------------
        'security_password_min'            => '8',
        'security_session_lifetime'        => '2592000',
        'security_session_bind_ip'         => '0',
        'security_contact_rate_max'        => '5',
        'security_contact_rate_window'     => '3600',
        'security_login_rate_max'          => '10',
        'security_login_rate_window'       => '900',
        'security_review_rate_max'         => '6',
        'security_review_rate_window'      => '3600',
        'security_submission_rate_max'     => '8',
        'security_submission_rate_window'  => '3600',

        // --- Rutas y mantenimiento ----------------------------------------
        // Carpeta de registros (vacío = app/data). Ruta absoluta recomendada.
        'paths_log_dir'        => '',
        // Modo mantenimiento: la web pública avisa y oculta el formulario.
        'maintenance_mode'     => '0',
        'maintenance_message'  => 'Estamos mejorando la web. Volvemos en unos minutos.',

        // --- Valoraciones y reseñas ---------------------------------------
        // Interruptor del módulo de valoraciones de servicios y proyectos.
        'reviews_enabled'        => '1',
        // Publicar automáticamente las valoraciones nuevas (0 = moderar antes).
        'reviews_auto_approve'   => '0',
        // Herramienta externa: 'trustpilot', 'google' o 'custom' (ninguna).
        'reviews_provider'       => 'trustpilot',
        // Web de la ficha de la empresa en Trustpilot (para valorar y enlazar).
        'trustpilot_url'         => 'https://es.trustpilot.com/review/[TU-DOMINIO]',
        // ID de la TrustBox (widget de reseñas de Trustpilot). Ej.: tu Business Unit ID.
        'trustpilot_business_id' => '[TRUSTPILOT_BUSINESS_ID]',
        // Plantilla de la TrustBox: 'carrusel' (reseñas) o 'estrellas' (mini valoración).
        'trustpilot_template'    => 'carrusel',
        // Enlace a la ficha de la empresa en Google (botón «Ver todas en Google»).
        'google_reviews_url'     => '[URL_GOOGLE_REVIEWS]',

        // --- Aportaciones de usuarios y FAQ -------------------------------
        // Testimonios y preguntas propuestas por usuarios registrados.
        'submissions_enabled'    => '1',
        // Publicar automáticamente (0 = requieren aprobación en el panel).
        'submissions_auto_approve' => '0',
        // Nº de preguntas relevantes que se muestran en la portada.
        'faq_portal_count'       => '6',
    ],

    /* --- Rutas del servidor ------------------------------------------------
       Valores por defecto; el panel (Ajustes · Rutas) puede sobrescribirlos.
       'log_dir' vacío = app/data. */
    'paths' => [
        'log_dir' => '',
    ],


    /* --- Importancia de las preguntas frecuentes --------------------------
       Pesos del algoritmo que decide qué preguntas destacan en la portada.
       Ver app/lib/faq.php para el detalle del cálculo. */
    'faq' => [
        'weight_weight'            => 8,    // x peso manual (0-5) -> hasta 40 ptos
        'weight_demand'            => 35,   // demanda de los usuarios -> hasta 35
        'weight_channel'           => 15,   // origen verificado -> hasta 15
        'weight_freshness'         => 10,   // frescura -> hasta 10
        'demand_threshold'         => 3,    // peticiones para saturar la demanda
        'freshness_halflife_days'  => 180,  // vida media de la frescura
        'portal_min_score'         => 20,   // mínimo para entrar en la portada
    ],
];
