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

    /* --- Correo (avisos del formulario de contacto y verificaciones) -------
       'transport' => 'smtp'  usa tu servidor SMTP (recomendado, mas fiable).
       'transport' => 'mail'  usa la funcion mail() del hosting (sin credenciales).
       'transport' => 'log'   no envia, escribe en app/data/mail.log (pruebas).

       Los avisos del formulario de contacto llegan a 'to_email'. Aqui ya esta
       puesto crotulus.mipyme@gmail.com. Para Gmail necesitas una CONTRASENA DE
       APLICACION (no la de tu cuenta) en 'smtp_pass'; ver README.md. */
    'mail' => [
        'transport'   => 'smtp',
        'from_email'  => '',                      // vacio = usa smtp_user (Gmail lo exige)
        'from_name'   => 'C-ROTULUS',
        // Correo que recibe los avisos (contacto, aportaciones, valoraciones).
        'to_email'    => 'crotulus.mipyme@gmail.com',
        'smtp_host'   => 'smtp.gmail.com',
        'smtp_port'   => 587,
        'smtp_user'   => 'crotulus.mipyme@gmail.com',
        'smtp_pass'   => '',                      // <- contraseña de aplicación de Google
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

    /* --- Herramientas ------------------------------------------------------
       Clave para abrir el diagnostico app/preflight.php desde el navegador
       (la version por linea de comandos no la necesita). Dejala vacia para
       desactivar el acceso web al diagnostico. */
    'preflight_key' => '',

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

        // --- Textos de la portada (hero) ----------------------------------
        // Todo lo editable de la portada vive aquí; la web lo aplica con
        // data-site. Deja el valor por defecto si no quieres cambiarlo.
        'hero_badge'      => 'Agencia de servicios tecnológicos · Pymes y autónomos',
        'hero_title'      => 'Tecnología clara que hace crecer tu negocio',
        'hero_title_accent' => 'hace crecer',
        'hero_subtitle'   => 'Ayudamos a pymes y autónomos a digitalizarse con desarrollo web, automatización e IA, redes seguras y soporte continuo. Menos problemas, más tiempo para lo que importa.',
        'hero_cta1_label' => 'Solicitar servicios',
        'hero_cta2_label' => 'Escríbenos por WhatsApp',
        'hero_image'      => 'assets/img/hero-tech.svg',
        'hero_image_alt'  => 'Panel de control de C-ROTULUS con gráficas, servicios en la nube y una red de datos conectada',

        // --- Cifras de confianza (portada) --------------------------------
        'stat1_value' => '12',  'stat1_label' => 'años de experiencia',
        'stat2_value' => '180', 'stat2_label' => 'clientes satisfechos',
        'stat3_value' => '350', 'stat3_label' => 'proyectos entregados',
        'stat4_value' => '24',  'stat4_label' => 'horas de respuesta',

        // --- Cabeceras de las secciones -----------------------------------
        // Patrón: eyebrow (etiqueta) / title (titular) / lead (subtítulo).
        'about_eyebrow' => 'Sobre nosotros',
        'about_title'   => 'Un equipo cercano con soluciones serias',
        'about_lead'    => 'Desde [AÑO DE FUNDACIÓN] acompañamos a empresas en su transformación digital, combinando tecnología y trato humano.',
        'team_eyebrow'  => 'Equipo',
        'team_title'    => 'Las personas detrás de C-ROTULUS',
        'team_lead'     => 'Un equipo pequeño, cercano y especializado. Estas son las personas que te atenderán y trabajarán en tu proyecto.',
        'services_eyebrow' => 'Servicios',
        'services_title'   => 'Todo lo que tu empresa necesita, en un solo equipo',
        'services_lead'    => 'Servicios de ejemplo fáciles de editar. Cada tarjeta incluye icono, descripción, contenido y botón de consulta.',
        'projects_eyebrow' => 'Proyectos',
        'projects_title'   => 'Trabajos que ya están dando resultados',
        'projects_lead'    => 'Una muestra de proyectos de ejemplo. Sustituye las imágenes, los textos y las etiquetas por tus casos reales.',
        'blog_eyebrow' => 'Blog',
        'blog_title'   => 'Ideas y consejos para tu negocio',
        'blog_lead'    => 'Publicamos guías sencillas sobre tecnología, seguridad y productividad. Sin tecnicismos innecesarios.',
        'process_eyebrow' => 'Cómo trabajamos',
        'process_title'   => 'Un proceso simple, en cuatro pasos',
        'process_lead'    => 'Sin sorpresas: te acompañamos desde la primera conversación hasta el soporte del día a día.',
        'testimonials_eyebrow' => 'Testimonios',
        'testimonials_title'   => 'Lo que opinan nuestros clientes',
        'testimonials_lead'    => 'Opiniones de clientes reales. Para compartir la tuya, entra en tu cuenta.',
        'reviews_eyebrow' => 'Opiniones',
        'reviews_title'   => 'Lo que opinan de nosotros en Google',
        'reviews_lead'    => 'Reseñas reales de clientes publicadas en nuestra ficha de Google. Puedes leerlas todas en un clic.',
        'trustpilot_eyebrow' => 'Reseñas verificadas',
        'trustpilot_title'   => 'Lo que dicen en Trustpilot',
        'trustpilot_lead'    => 'Opiniones reales de clientes publicadas en nuestra ficha de Trustpilot.',
        'contact_eyebrow' => 'Contacto',
        'contact_title'   => 'Cuéntanos tu proyecto',
        'contact_lead'    => 'Rellena el formulario y te respondemos en menos de 24 horas laborables.',
        'location_eyebrow' => 'Ubicación',
        'location_title'   => 'Dónde estamos y cómo contactarnos',
        'location_lead'    => 'Visítanos, llámanos o escríbenos. Estamos a tu disposición en horario de oficina.',
        'faq_eyebrow' => 'Preguntas frecuentes',
        'faq_title'   => 'Resolvemos tus dudas',
        'faq_lead'    => 'Mostramos las preguntas más relevantes, ordenadas automáticamente por su importancia.',

        // --- Sobre nosotros (cuerpo) --------------------------------------
        'about_body' => 'C-ROTULUS nació con una idea sencilla: la tecnología no debería ser un dolor de cabeza. Empezamos resolviendo pequeños problemas informáticos para negocios de nuestro entorno y, con el tiempo, ampliamos el servicio hasta diseñar, desplegar y mantener la infraestructura digital completa de nuestros clientes.',
        'about_image'     => 'assets/img/equipo.svg',
        'about_image_alt' => 'Equipo de profesionales de C-ROTULUS trabajando en un proyecto',

        // --- Pie de página -------------------------------------------------
        'footer_tagline' => 'Servicios tecnológicos para empresas. Desarrollo, automatización, redes y soporte con trato cercano.',
        'footer_legal'   => 'Aviso legal · Privacidad · Cookies',

        // --- Contacto y redes ---------------------------------------------
        'telefono'    => '+5359888821',
        'whatsapp'    => '5359888821',
        'correo'      => 'crotulus.mipyme@gmail.com',
        'direccion'   => 'Calle 29 #5408 e/ 54 y 56',
        'ciudad'      => 'Artemisa',
        'horario'     => 'Lunes a Viernes de 9:00 am a 5:00 pm',
        // URL de incrustacion de Google Maps (ver README, apartado "Mapa").
        'mapa_embed'  => 'https://www.google.com/maps?q=Calle%2029%20%235408%20e%2F%2054%20y%2056%2C%20Artemisa%2C%20Cuba&output=embed',
        'google_maps_url' => 'https://www.google.com/maps/dir/?api=1&destination=Calle%2029%20%235408%20e%2F%2054%20y%2056%2C%20Artemisa%2C%20Cuba',
        'facebook'    => 'https://www.facebook.com/com.rotulus.surl',
        'instagram'   => '[URL_INSTAGRAM]',
        'linkedin'    => '[URL_LINKEDIN]',
        'github'      => '[URL_GITHUB]',

        // --- Correo saliente (editable desde el panel) --------------------
        // Por defecto, SMTP de Gmail con el correo de contacto como remitente
        // y destino de los avisos. Rellena la contraseña de aplicación desde
        // el panel (Ajustes > Correo) o en 'smtp_pass' de config.local.php.
        'mail_transport'   => 'smtp',
        'mail_from_email'  => '',                 // vacio = usa el usuario SMTP
        'mail_from_name'   => 'C-ROTULUS',
        // Destino de los avisos. Si está vacío se usa el correo de contacto.
        'mail_to_email'    => 'crotulus.mipyme@gmail.com',
        'mail_smtp_host'   => 'smtp.gmail.com',
        'mail_smtp_port'   => '587',
        'mail_smtp_user'   => 'crotulus.mipyme@gmail.com',
        'mail_smtp_pass'   => '',                 // <- contraseña de aplicación
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
        'google_reviews_url'     => 'https://www.google.com/maps/search/?api=1&query=C-ROTULUS+Artemisa',
        // Reseñas de Google EN VIVO (Google Places API, plan gratuito).
        // Pega aquí el place_id de tu ficha y una clave de API de Google Places
        // (en el panel · Ajustes · Reseñas). Si están vacíos, la sección muestra
        // las reseñas escritas en el HTML.
        'google_place_id'        => '',
        'google_places_api_key'  => '',
        // Horas de caché antes de volver a consultar a Google (por defecto 6 h).
        'google_reviews_cache_ttl' => '21600',

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
