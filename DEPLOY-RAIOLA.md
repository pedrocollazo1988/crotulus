# Despliegue en Raiola Networks (cPanel + CloudLinux + LiteSpeed)

Guía específica para publicar C-ROTULUS en un **hosting compartido de Raiola
Networks**. Sigue los pasos en orden. Si solo quieres la web estática (sin panel
ni formulario), puedes saltarte los pasos marcados con *(backend)*.

> **Datos clave de Raiola:** panel **cPanel**, servidor **LiteSpeed**, sistema
> **CloudLinux**, copias de seguridad con **JetBackup** y, en hosting compartido,
> **no hay acceso SSH** (sí en Hosting Elástico / VPS). Por eso el diagnóstico se
> ejecuta por navegador (paso 6), no por terminal.

## Índice

1. [Subir los archivos](#1-subir-los-archivos)
2. [Elegir la versión de PHP](#2-elegir-la-versión-de-php)
3. [Crear la base de datos *(backend)*](#3-crear-la-base-de-datos-backend)
4. [Crear `app/config.local.php` *(backend)*](#4-crear-appconfiglocalphp-backend)
5. [Correo con tu dominio *(backend)*](#5-correo-con-tu-dominio-backend)
6. [Activar la página 404 y el `.htaccess` de Raiola](#6-activar-la-página-404-y-el-htaccess-de-raiola)
7. [SSL, Cloudflare y HTTPS](#7-ssl-cloudflare-y-https)
8. [Primer administrador y contenidos *(backend)*](#8-primer-administrador-y-contenidos-backend)
9. [Copia de seguridad automática (cron)](#9-copia-de-seguridad-automática-cron)
10. [Checklist final](#10-checklist-final)

---

## 1. Subir los archivos

Raiola te da acceso **FTP** y el **Administrador de archivos** de cPanel.

1. Entra en **cPanel → Administrador de archivos** y abre la carpeta `public_html`
   (es la raíz de tu dominio; si tienes varios dominios, cada uno tiene la suya).
2. Sube **todo el contenido** del proyecto. Lo más rápido: sube el ZIP
   `c-rotulus-sitio.zip` a `public_html` y pulsa **Extract**. El ZIP ya viene
   **sin carpeta contenedora**, así que los archivos quedan directamente en
   `public_html` (no dentro de una subcarpeta). Luego borra el ZIP del servidor.
   - `index.html`, `404.html`, `robots.txt`, `sitemap.xml`, `.htaccess`
   - `css/`, `js/`, `assets/`
   - `api/`, `admin/`, `app/` *(backend)*
   - `deploy/` (contiene herramientas; queda bloqueado por el `.htaccess`)
3. **No subas** `app/config.local.php` de tus pruebas ni el propio ZIP.

> Truco: en FileZilla activa *Servidor → Forzar visualización de archivos ocultos*
> para ver y subir el `.htaccess`.

---

## 2. Elegir la versión de PHP

En Raiola la versión de PHP **no** se define en `.htaccess` (CloudLinux), sino en cPanel:

1. **cPanel → Software → Seleccionar versión PHP**.
2. Elige **PHP 8.1, 8.2 o 8.3** (C-ROTULUS requiere 8.0 o superior).
3. Si tienes varios dominios y quieres cambiarla solo en uno, usa
   **Domain PHP Selector** y aplícala a la carpeta de tu dominio.
4. Comprueba que las extensiones necesarias están activas:
   `pdo`, `pdo_mysql`, `json`, `mbstring`, `openssl`, `filter` y `curl`
   (**cPanel → Software → Seleccionar módulos PHP**, o vienen activas por defecto).

> No añadas líneas `AddHandler`/`AddType` de PHP al `.htaccess`: con LiteSpeed
> romperían el sitio. La versión se elige siempre desde cPanel.

---

## 3. Crear la base de datos *(backend)*

**cPanel → Bases de datos → Bases de datos MySQL**:

1. Crea la base de datos. Raiola añade un prefijo: si tu usuario es `crotulu`,
   la base se llamará `crotulu_crotulus`.
2. Crea un usuario (p. ej. `crotulu_crotulus`) con una contraseña fuerte.
3. **Añade el usuario a la base de datos** con **TODOS los privilegios**.

Apunta los cuatro datos: **host** (`localhost`), **nombre**, **usuario** y
**contraseña**. Las tablas se crearán solas al abrir el sitio; si lo prefieres,
importa `app/schema.sql` desde **phpMyAdmin**.

---

## 4. Crear `app/config.local.php` *(backend)*

1. Copia la plantilla específica de Raiola:
   ```
   deploy/raiola/config.local.example.php  ->  app/config.local.php
   ```
   (o edítala directamente en el *Administrador de archivos*).
2. Rellena los datos de la base de datos del paso 3, tu dominio y una **app_key**
   aleatoria. La plantilla ya trae los valores típicos de Raiola.
3. Genera la `app_key` (cualquier generador de cadenas de 64 caracteres sirve).

> `config.local.php` tiene prioridad sobre `config.php` y queda protegido por
> `app/.htaccess`. No lo subas a ningún repositorio.

---

## 5. Correo con tu dominio *(backend)*

Lo más fiable en Raiola es usar **su propio servidor de correo**:

1. **cPanel → Cuentas de correo electrónico → Crear** una cuenta como
   `no-reply@tu-dominio.com`.
2. Pulsa **Connect Devices** en esa cuenta y elige **SSL/TLS**; ahí verás los
   datos exactos de SMTP.
3. Rellena en `app/config.local.php`, apartado `mail`:
   ```
   'transport'   => 'smtp',
   'smtp_host'   => 'mail.tu-dominio.com',
   'smtp_port'   => 465,            // 465 con SSL, 587 con TLS
   'smtp_user'   => 'no-reply@tu-dominio.com',
   'smtp_pass'   => 'la-contraseña-de-la-cuenta',
   'smtp_secure' => 'ssl',          // ssl (465) | tls (587)
   ```
4. Después, en el panel → **Ajustes**, pulsa **«Enviar correo de prueba»**.

---

## 6. Activar la página 404 y el `.htaccess` de Raiola

1. **Usa el `.htaccess` de Raiola** (optimizado para LiteSpeed). Copia el
   contenido de `deploy/raiola/.htaccess-raiola` a tu `.htaccess` en `public_html`
   (sustituye al general). Ya trae:
   - `ErrorDocument 404 /404.html`
   - caché, compresión, cabeceras de seguridad,
   - bloqueo de `app/`, `deploy/`, `tools/`, `.sqlite`, `.log`, `.md`, `.zip`
     y `config.local.php`,
   - **el backend (`/api/`, `/admin/`) sin caché** (importante en LiteSpeed).
2. Asegúrate de que **`404.html` está en `public_html`** (ya lo has subido en el
   paso 1). Pruébalo abriendo una URL inexistente, p. ej.
   `https://tu-dominio.com/loquesea`.

---

## 7. SSL, Cloudflare y HTTPS

1. **Certificado SSL**: **cPanel → SSL/TLS** o *Let's Encrypt*: emite el
   certificado gratuito para tu dominio y `www`. Raiola lo renueva solo.
2. **¿Usas Cloudflare?** Raiola lo ofrece. Si lo activas:
   - En el `.htaccess` de Raiola, descomenta la redirección **(B) CON Cloudflare**
     (mira `X-Forwarded-Proto`, no `%{HTTPS}`, para evitar bucles).
   - En `app/config.local.php`, deja `session_bind_ip => false` y, opcionalmente,
     añade los rangos de Cloudflare a `trusted_proxies` (los tienes en
     `cloudflare.com/ips`).
   - Si **no** usas Cloudflare, descomenta la redirección **(A)** y sustituye
     `TU-DOMINIO` por el tuyo.
3. Cuando el SSL esté activo, descomenta `Strict-Transport-Security` en el
   `.htaccess` y actualiza `site_url` en `app/config.local.php` a `https://...`.

---

## 8. Primer administrador y contenidos *(backend)*

1. Ejecuta el diagnóstico. Como en Raiola no hay SSH, usa la vía web:
   - En `app/config.local.php` pon una clave: `'preflight_key' => 'una-clave-larga'`.
   - Abre `https://tu-dominio.com/app/preflight.php?key=una-clave-larga`.
   - Revisa que todo esté en **OK** (si hay avisos, te dice qué falta).
   - Al terminar, borra `app/preflight.php` del hosting si quieres.
2. Entra en `https://tu-dominio.com/admin/register.php` y **registra el primer
   usuario** (será administrador). Verifica el correo si el SMTP ya funciona.
3. En el panel revisa **Ajustes** (teléfono, correo, dirección, mapa, redes),
   **Textos** (portada, cifras, pie) y **Contenido** (servicios, proyectos, FAQ...).

---

## 9. Copia de seguridad automática (cron)

Raiola incluye **JetBackup** (copias del hosting, **cPanel → JetBackup**) y
también permite **tareas cron**. Puedes combinar las dos cosas:

- **JetBackup** (recomendado): copias automáticas de toda la cuenta. Puedes
  restaurar o descargar archivos y bases de datos cuando quieras.
- **Copia propia de la base de datos** con la herramienta incluida:
  1. **cPanel → Avanzado → Trabajos de cron** → *Añadir nuevo trabajo de cron*.
  2. Elige **una vez al día** (p. ej. 03:00) y este comando:
     ```
     /usr/local/bin/php /home/TUUSUARIO/public_html/deploy/cron/backup.php >/dev/null 2>&1
     ```
     Si `/usr/local/bin/php` no existe, usa la ruta de EasyApache 4, por ejemplo:
     ```
     /opt/cpanel/ea-php82/root/usr/bin/php /home/TUUSUARIO/public_html/deploy/cron/backup.php
     ```
     (cambia `ea-php82` por tu versión). Crea copias con fecha en
     `app/data/backups/` y conserva las últimas 14.

---

## 10. Checklist final

- [ ] Archivos subidos a `public_html` (con `.htaccess` y `404.html`).
- [ ] PHP 8.1/8.2/8.3 seleccionado en cPanel y extensiones activas.
- [ ] Base de datos creada y usuario con todos los privilegios *(backend)*.
- [ ] `app/config.local.php` con dominio, MySQL, SMTP y `app_key` *(backend)*.
- [ ] `.htaccess` de Raiola activo y redirección HTTPS elegida.
- [ ] SSL activo y `site_url` en `https://` (sin barra final).
- [ ] Diagnóstico `preflight.php` en verde.
- [ ] Primer usuario admin creado y contenidos revisados.
- [ ] Copia de seguridad (JetBackup y/o cron) configurada.
- [ ] `robots.txt` y `sitemap.xml` con tu dominio real, y JSON-LD de `index.html`
      actualizado (busca `c-rotulus.example`).

## Problemas típicos en Raiola

| Síntoma | Causa | Solución |
|---|---|---|
| Error 500 tras subir el `.htaccess` | Alguna directiva no permitida por LiteSpeed/CloudLinux | Usa el `.htaccess` de Raiola (todo va dentro de `<IfModule>`); revisa `app/data/app.log` |
| «No se pudo conectar a la base de datos» | Datos de MySQL incorrectos o usuario sin privilegios | Revisa `config.local.php` y asigna el usuario con **todos** los privilegios |
| No llegan los correos | SMTP mal configurado | Usa `mail.tu-dominio.com` con SSL 465 y el usuario completo; prueba «Enviar correo de prueba» |
| Los cambios del panel no se ven | Caché de LiteSpeed o del navegador | El `.htaccess` de Raiola ya marca `/api/` y `/admin/` como no-cache; sube `?v=...` en `index.html` |
| Bucle de redirección HTTPS | Cloudflare activo con redirección por `%{HTTPS}` | Usa la variante **(B)** del `.htaccess` (mira `X-Forwarded-Proto`) |
| `app/config.local.php` se descarga | `.htaccess` no aplicado | Comprueba que el `.htaccess` está en `public_html` y que LiteSpeed lo lee |
