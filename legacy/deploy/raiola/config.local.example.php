<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  C-ROTULUS · CONFIGURACION DE PRODUCCION PARA RAIOLA NETWORKS (EJEMPLO)
 * ----------------------------------------------------------------------------
 *  Raiola usa cPanel + CloudLinux + LiteSpeed. Antes de subir este archivo:
 *
 *  1) En cPanel, elige la version de PHP:  Software > "Seleccionar version PHP"
 *     -> PHP 8.1 / 8.2 / 8.3  (o "Domain PHP Selector" para un solo dominio).
 *  2) Crea la base de datos:  cPanel > "Bases de datos MySQL" -> crear base de
 *     datos, crear usuario, asignarlo con TODOS los privilegios.
 *     Raiola nombra las bases como  usuarioNOMBRE  (p. ej. crotulu_crotulus).
 *  3) Copia este archivo como  app/config.local.php  y rellena los datos.
 *  4) Genera una app_key:  php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
 *  5) Comprueba:  php app/preflight.php   (o por web con preflight_key)
 *
 *  Recuerda: los datos exactos de MySQL y de correo te los da tu cPanel
 *  ("Bases de datos MySQL" y "Cuentas de correo electronico > Connect Devices").
 * ============================================================================
 */

return [

    /* --- Dominio -----------------------------------------------------------
       Sin barra final. */
    'site_url' => 'https://www.tu-dominio.com',
    'timezone' => 'Europe/Madrid',

    /* --- Base de datos (MySQL/MariaDB) -------------------------------------
       Host casi siempre 'localhost' en Raiola. El nombre y el usuario llevan
       el prefijo de tu cuenta de cPanel. */
    'db' => [
        'driver'   => 'mysql',
        'host'     => 'localhost',
        'port'     => 3306,
        'name'     => 'tuusuario_crotulus',      // cPanel > Bases de datos MySQL
        'user'     => 'tuusuario_crotulus',      // usuario asignado a la base
        'password' => 'CONTRASENA_DE_LA_BD',
        'charset'  => 'utf8mb4',
    ],

    /* --- Correo ------------------------------------------------------------
       Raiola te da correo con tu propio dominio. Lo mas comodo y fiable es
       usar el servidor de Raiola (no Gmail). Datos tipicos:

         Host SMTP:   mail.tu-dominio.com
         Puerto:      465 (SSL)  o  587 (TLS)
         Usuario:     la cuenta de correo completa (no-reply@tu-dominio.com)

       Los datos exactos: cPanel > "Cuentas de correo electronico" >
       "Connect Devices" sobre la cuenta. Elige SSL/TLS. */
    'mail' => [
        'transport'   => 'smtp',
        'from_email'  => 'no-reply@tu-dominio.com',
        'from_name'   => 'C-ROTULUS',
        'to_email'    => 'crotulus.mipyme@gmail.com',  // donde quieres recibir los avisos
        'smtp_host'   => 'mail.tu-dominio.com',
        'smtp_port'   => 465,
        'smtp_user'   => 'no-reply@tu-dominio.com',
        'smtp_pass'   => 'contrasena-de-la-cuenta-de-correo',
        'smtp_secure' => 'ssl',                   // ssl (465) | tls (587)
    ],

    /* --- Google OAuth (opcional) ------------------------------------------- */
    'google' => [
        'client_id'     => '',
        'client_secret' => '',
        'redirect_uri'  => '',
    ],

    /* --- Seguridad --------------------------------------------------------- */
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
        // En Raiola el hosting puede estar detras de Cloudflare. Con Cloudflare
        // la IP de salida cambia: deja esto en false para no cerrar sesiones.
        'session_bind_ip'     => false,
        // Si usas Cloudflare, anade aqui los rangos de Cloudflare para que el
        // sitio lea la IP real del visitante:
        //   https://www.cloudflare.com/ips/   (IPv4 e IPv6)
        // Ejemplo: ['173.245.48.0/20', '103.21.244.0/22', ...]
        'trusted_proxies'     => [],
    ],

    /* --- Diagnostico -------------------------------------------------------
       Clave para abrir app/preflight.php desde el navegador (opcional). */
    'preflight_key' => '',

];
