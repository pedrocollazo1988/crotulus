<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  C-ROTULUS · CONFIGURACION DE PRODUCCION (EJEMPLO)
 * ----------------------------------------------------------------------------
 *  INSTRUCCIONES
 *  1) Copia este archivo como  app/config.local.php
 *         cp deploy/config.local.example.php app/config.local.php
 *  2) Rellena los datos reales de tu hosting (MySQL, dominio, SMTP...).
 *  3) Genera una app_key aleatoria:
 *         php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
 *  4) Comprueba que todo esta bien:
 *         php app/preflight.php
 *
 *  IMPORTANTE: config.local.php tiene PRIORIDAD sobre config.php y NO debe
 *  subirse a un repositorio publico (contiene contrasenas). Ya esta en
 *  .gitignore. En el hosting queda protegido por app/.htaccess.
 * ============================================================================
 */

return [

    /* --- Dominio ------------------------------------------------------------
       Sin barra final. Si lo dejas vacio, se detecta solo (util en pruebas). */
    'site_url' => 'https://www.tu-dominio.com',
    'timezone' => 'Europe/Madrid',

    /* --- Base de datos -----------------------------------------------------
       MySQL/MariaDB es lo recomendado en hosting compartido. Los datos te los
       da el proveedor (cPanel > Bases de datos MySQL). */
    'db' => [
        'driver'   => 'mysql',                    // mysql | sqlite
        'host'     => 'localhost',                // a veces 'mysql.tuproveedor.com'
        'port'     => 3306,
        'name'     => 'tu_usuario_crotulus',      // nombre de la base de datos
        'user'     => 'tu_usuario_crotulus',      // usuario de la base de datos
        'password' => 'CONTRASENA_DE_LA_BD',      // contrasena de la base de datos
        'charset'  => 'utf8mb4',
    ],

    /* --- Correo (verificacion de cuenta y avisos) --------------------------
       'smtp' es lo mas fiable. Para Gmail mira README.md (contrasena de
       aplicacion de 16 caracteres, no la del correo).
       Este ejemplo ya deja los avisos del formulario apuntando a
       crotulus.mipyme@gmail.com: solo falta rellenar 'smtp_pass'. */
    'mail' => [
        'transport'   => 'smtp',                  // smtp | mail | log
        'from_email'  => '',                      // vacio = usa smtp_user (Gmail)
        'from_name'   => 'C-ROTULUS',
        'to_email'    => 'crotulus.mipyme@gmail.com',  // recibe contacto, aportaciones...
        'smtp_host'   => 'smtp.gmail.com',
        'smtp_port'   => 587,
        'smtp_user'   => 'crotulus.mipyme@gmail.com',
        'smtp_pass'   => 'contrasena-de-aplicacion',  // 16 caracteres, sin espacios
        'smtp_secure' => 'tls',                   // tls (587) | ssl (465)
    ],

    /* --- Google OAuth (opcional) -------------------------------------------
       Deja client_id vacio para ocultar el boton "Continuar con Google".
       URI de redireccion autorizada:
           https://TU-DOMINIO/api/auth.php?action=google_callback */
    'google' => [
        'client_id'     => '',
        'client_secret' => '',
        'redirect_uri'  => '',
    ],

    /* --- Seguridad ---------------------------------------------------------
       app_key: cadena larga y aleatoria. Genera con:
           php -r "echo bin2hex(random_bytes(32)), PHP_EOL;" */
    'security' => [
        'app_key'             => 'PEGA-AQUI-UNA-CADENA-LARGA-Y-ALEATORIA-DE-64-CARACTERES',
        'session_name'        => 'crotulus_sid',
        'session_lifetime'    => 60 * 60 * 24 * 30,
        'contact_rate_max'    => 5,
        'contact_rate_window' => 3600,
        'login_rate_max'      => 10,
        'login_rate_window'   => 900,
        'review_rate_max'     => 6,
        'review_rate_window'  => 3600,
        'submission_rate_max' => 8,
        'submission_rate_window' => 3600,
        'password_min'        => 8,
        'password_max'        => 200,
        // Ponlo a true SOLO en un hosting simple (una sola maquina, sin CDN).
        'session_bind_ip'     => false,
        // Solo si hay un proxy/CDN de confianza delante (p. ej. Cloudflare).
        'trusted_proxies'     => [],
    ],

    /* --- Diagnostico -------------------------------------------------------
       Clave para abrir app/preflight.php desde el navegador:
           https://TU-DOMINIO/app/preflight.php?key=ESTA_CLAVE
       Dejala vacia para desactivar el acceso web. */
    'preflight_key' => '',

];
