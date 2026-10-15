# Guía de despliegue de C-ROTULUS

Esta guía lleva el sitio desde lo **más básico** (subir archivos por FTP a un
hosting gratuito) hasta lo **más avanzado** (VPS con Nginx, SSH, copias
automáticas y CDN). Elige tu nivel y sigue solo esa parte.

> Resumen de una línea: sube **todo el contenido** del proyecto a la carpeta
> `public_html` del hosting, crea `app/config.local.php` con tus datos y ejecuta
> `php app/preflight.php` para comprobar que todo está bien.

---

## Índice

- [Antes de empezar](#antes-de-empezar)
- [Nivel 1 · Básico: subir el sitio a mano](#nivel-1--básico-subir-el-sitio-a-mano)
- [Nivel 2 · Intermedio: cPanel / Plesk (MySQL, correo, SSL, cron)](#nivel-2--intermedio-cpanel--plesk)
- [Nivel 3 · Avanzado: VPS con SSH, rsync, Nginx y backups](#nivel-3--avanzado-vps)
- [Comprobar que todo funciona](#comprobar-que-todo-funciona)
- [Datos que hay que cambiar antes de publicar](#datos-que-hay-que-cambiar-antes-de-publicar)
- [Problemas frecuentes](#problemas-frecuentes)

---

## Antes de empezar

**Qué es este proyecto.** Una web de una sola página (`index.html`) más un
backend opcional en PHP (`api/`, `admin/`, `app/`) que permite editar el
contenido y recibir mensajes. El sitio **funciona sin backend**: si PHP no está
disponible o no quieres base de datos, la página se ve igual (con el contenido
de ejemplo del HTML).

**Qué necesitas según lo que quieras:**

| Quiero... | Necesito |
|---|---|
| Solo ver la web (sin panel ni formulario guardado) | Un hosting con HTML estático |
| Formulario + panel de administración | Hosting con **PHP 8+** y **MySQL** o **SQLite** |
| Correos reales (verificación, avisos) | Una cuenta SMTP |

**Requisitos mínimos del backend** (los comprueba el diagnóstico):
- PHP **8.0** o superior.
- Extensiones: `pdo`, `json`, `mbstring`, `openssl`, `filter` y `pdo_mysql`
  (o `pdo_sqlite`). `curl` es recomendable.
- Escritura permitida en `app/data/` (solo si usas SQLite o el modo `log`).

**Archivos que NO debes subir:** `c-rotulus-sitio.zip`, `.git/`, `.agent_tmp/`
y tu `app/config.local.php` de pruebas (ese lo crearás nuevo en el servidor).
El ZIP que genera `python3 tools/build_zip.py` ya viene limpio.

---

## Nivel 1 · Básico: subir el sitio a mano

Ideal para el **hosting más simple** o para publicar solo la web.

1. **Localiza la carpeta destino.** En cPanel suele llamarse `public_html`; en
   otros paneles, `www`, `htdocs` o `httpdocs`. Es la carpeta que se ve en tu
   dominio.
2. **Sube los archivos.** Con un cliente FTP (FileZilla, Cyberduck) o el
   *Administrador de archivos* del panel:
   - Conecta con los datos que te dio el hosting (servidor FTP, usuario, contraseña).
   - Arrastra **todo el contenido** del proyecto a `public_html`. No subas la
     carpeta contenedora, sino los archivos y subcarpetas de dentro
     (`index.html`, `css/`, `js/`, `assets/`, `api/`, `admin/`, `app/`,
     `.htaccess`, `robots.txt`, `sitemap.xml`).
3. **Activa los archivos ocultos.** `.htaccess` empieza por punto; en FileZilla
   activa *Servidor → Forzar visualización de archivos ocultos*.
4. **Abre tu dominio** en el navegador. Si ves la portada, el nivel básico está hecho.

> Si no vas a usar el backend (sin PHP), puedes subir solo `index.html`,
> `css/`, `js/` y `assets/`. El resto (`api/`, `admin/`, `app/`) no molesta,
> pero puedes omitirlo.

---

## Nivel 2 · Intermedio: cPanel / Plesk

Para aprovechar el **panel de administración**, el **formulario** y el **correo**.

### 2.1. Crear la base de datos (MySQL/MariaDB)

En **cPanel → Bases de datos MySQL** (o *MySQL Databases*):
1. Crea una base de datos, p. ej. `tuusuario_crotulus`.
2. Crea un usuario y asígnale una contraseña fuerte.
3. Añade el usuario a la base de datos con **todos los privilegios**.

Guarda estos cuatro datos: **host** (normalmente `localhost`), **nombre de la
base de datos**, **usuario** y **contraseña**.

### 2.2. Crear `app/config.local.php`

1. Copia la plantilla de ejemplo:
   ```
   cp deploy/config.local.example.php app/config.local.php
   ```
   (o edítalo directamente en el *Administrador de archivos*).
2. Rellena los datos de la base de datos, tu dominio y el correo. Ejemplo:
   ```php
   'site_url' => 'https://www.tu-dominio.com',
   'db' => [
       'driver'   => 'mysql',
       'host'     => 'localhost',
       'name'     => 'tuusuario_crotulus',
       'user'     => 'tuusuario_crotulus',
       'password' => 'la-contrasena-que-elegiste',
       'charset'  => 'utf8mb4',
   ],
   ```
3. Genera una **app_key** aleatoria y pégala en `security.app_key`:
   ```
   php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
   ```
   Si tu hosting no tiene acceso a terminal, usa cualquier generador de cadenas
   aleatorias largas (32+ caracteres).

> `config.local.php` tiene prioridad sobre `config.php`, así que no pierdes tus
> datos al actualizar el proyecto. Está protegido por `app/.htaccess`.

### 2.3. Importar las tablas (opcional)

Las tablas se crean **solas** la primera vez que se abre el sitio. Si tu
proveedor no permite crear tablas en ejecución, impórtalas a mano:
1. **cPanel → phpMyAdmin** → selecciona tu base de datos.
2. Pestaña **SQL** → pega el contenido de `app/schema.sql` → **Continuar**.

### 2.4. Configurar el correo (SMTP)

En `app/config.local.php`, apartado `mail`, pon `transport => 'smtp'` y rellena
los datos de tu proveedor. Para Gmail necesitas una **contraseña de aplicación**
de 16 caracteres (no la del correo normal):

| Proveedor | Host | Puerto | Seguridad |
|---|---|---|---|
| Gmail | `smtp.gmail.com` | 587 | `tls` |
| Outlook/Office 365 | `smtp.office365.com` | 587 | `tls` |
| El propio hosting | `mail.tu-dominio.com` | 587 o 465 | `tls` / `ssl` |

Después, en el panel (**Ajustes**), pulsa **«Enviar correo de prueba»**.

### 2.5. Activar HTTPS (SSL)

1. **cPanel → SSL/TLS** (o *Let's Encrypt SSL*): emite un certificado gratuito
   para tu dominio y `www`.
2. Cuando esté activo, descomenta la redirección HTTPS en `.htaccess`
   (sección *HTTPS obligatorio*). Elige la variante **sin www**, **con www** o
   **detrás de proxy**, según tu caso.
3. Descomenta también `Strict-Transport-Security` en la sección de cabeceras.

### 2.6. Tareas programadas (cron) para copias de seguridad

En **cPanel → Tareas cron**, añade una tarea diaria (por ejemplo a las 3:00):

```
0 3 * * *  /usr/bin/php /home/TUUSUARIO/public_html/deploy/cron/backup.php >/dev/null 2>&1
```

Ajusta la ruta y el binario de PHP (`/usr/bin/php`, `/usr/local/bin/php`...).
Crea una copia con fecha en `app/data/backups/` y conserva las últimas 14.

### 2.7. Primer administrador

1. Entra en `https://TU-DOMINIO/admin/register.php` y **registra el primer usuario**:
   será administrador automáticamente.
2. Verifica el correo si el SMTP ya funciona.
3. En el panel, revisa **Ajustes** (teléfono, correo, dirección, mapa, redes),
   **Contenido** (servicios, proyectos, FAQ...) y **Textos** (portada, cifras,
   «Sobre nosotros», pie).

---

## Nivel 3 · Avanzado: VPS

Para **servidor propio** (VPS/dedicado) con SSH, Nginx o Apache, y control total.

### 3.1. Servidor web

- **Nginx**: usa la plantilla `deploy/nginx/nginx.conf.example`. Copia a
  `/etc/nginx/sites-available/tu-dominio`, ajusta rutas y versión de PHP-FPM,
  activa el sitio y recarga:
  ```
  ln -s /etc/nginx/sites-available/tu-dominio /etc/nginx/sites-enabled/
  nginx -t && systemctl reload nginx
  ```
  La plantilla ya bloquea `app/`, `deploy/`, `tools/`, los `.sqlite`/`.log` y
  `config.local.php`, además de cachear estáticos y comprimir con gzip.
- **Apache**: el propio `.htaccess` del proyecto ya trae las reglas.

### 3.2. Certificado SSL

```
apt install certbot python3-certbot-nginx
certbot --nginx -d tu-dominio.com -d www.tu-dominio.com
```
Certbot renueva el certificado automáticamente.

### 3.3. Despliegue con rsync (sin FTP)

El script `deploy/deploy.sh` sincroniza el sitio por SSH y **no sobrescribe**
`app/config.local.php` ni tus datos:
```
./deploy/deploy.sh usuario@tu-servidor.com /var/www/tu-dominio/public_html
```
Para no escribir la contraseña cada vez, usa una **clave SSH**:
```
ssh-keygen -t ed25519
ssh-copy-id usuario@tu-servidor.com
```

### 3.4. Permisos

```
chown -R www-data:www-data /var/www/tu-dominio/public_html
find /var/www/tu-dominio/public_html -type d -exec chmod 755 {} \;
find /var/www/tu-dominio/public_html -type f -exec chmod 644 {} \;
chmod -R 750 /var/www/tu-dominio/public_html/app/data   # solo lectura para el resto
```

### 3.5. Copias de seguridad y restauración

- **Crear copia**: `php deploy/cron/backup.php` (o vía cron, como en el nivel 2).
- **Restaurar (MySQL)**: `mysql -u USUARIO -p BASE < app/data/backups/crotulus-FECHA.sql`
- **Restaurar (SQLite)**: copia el archivo `crotulus-FECHA.sqlite` sobre
  `app/data/c-rotulus.sqlite` (hazlo con el sitio parado o sin tráfico).

### 3.6. Monitorización y rendimiento

- **Salud del backend**: `https://TU-DOMINIO/api/index.php?resource=health`
  devuelve `{"status":"ok","driver":"mysql"}`.
- **Registros**: `app/data/app.log` y `app/data/mail.log` (o la carpeta que
  definas en *Ajustes → Rutas*).
- **CDN (opcional)**: pon Cloudflare delante. Si lo haces, deja
  `session_bind_ip` en `false` y añade la IP/red del CDN a `trusted_proxies`,
  y usa la redirección HTTPS «detrás de proxy» del `.htaccess`.
- **Sesiones detrás de balanceador**: mantén `session_bind_ip => false` para
  que la sesión no se cierre al cambiar la IP de salida.

---

## Comprobar que todo funciona

Ejecuta el diagnóstico incluido. Revisa PHP, extensiones, permisos, `.htaccess`,
conexión a la base de datos, tablas, usuarios, HTTPS y correo:

```
php app/preflight.php
```

Si no tienes terminal, actívalo por web: pon una clave en
`config.local.php` → `'preflight_key' => 'una-clave-larga'` y abre:

```
https://TU-DOMINIO/app/preflight.php?key=una-clave-larga
```

Al terminar de usarlo, puedes borrar `app/preflight.php` del servidor.

---

## Datos que hay que cambiar antes de publicar

Busca los marcadores `[...]` en los archivos o edítalos desde el panel:

| Marcador | Dónde se edita |
|---|---|
| `[TELÉFONO]`, `[CORREO]`, `[DIRECCIÓN]`, `[WHATSAPP]` | Panel → Ajustes (o `app/config.php`) |
| Dominio en `robots.txt` y `sitemap.xml` | Edita esos dos archivos |
| Redes sociales (`[URL_FACEBOOK]`, etc.) | Panel → Ajustes |
| Textos de portada, cifras, pie | Panel → Textos |
| Imágenes (`assets/img/`) | Sustituye el archivo o cambia la ruta en Panel → Textos |

Recuerda también sustituir `https://www.c-rotulus.example` en `index.html`
(datos estructurados JSON-LD, Open Graph) por tu dominio real.

---

## Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| Error 500 al abrir el sitio | Falta `pdo_mysql` o la config tiene un error | Ejecuta `php app/preflight.php`; revisa `app/data/app.log` |
| «No se pudo conectar a la base de datos» | Datos de MySQL incorrectos | Revisa host, nombre, usuario y contraseña en `config.local.php` |
| El panel dice «sin permisos» | Tu usuario no es administrador | El **primer** usuario registrado es admin; revisa la tabla `users` |
| No llegan los correos | SMTP mal configurado o bloqueado | Prueba «Enviar correo de prueba»; usa el SMTP del propio hosting |
| `app/config.local.php` visible en el navegador | Falta `app/.htaccess` o el servidor no lo lee | Comprueba que existe y que usas Apache; en Nginx usa la plantilla incluida |
| Los cambios no se ven | Caché del navegador | Sube la versión en `index.html` (`?v=...`) y en `app/bootstrap.php` |
| Redirección en bucle con HTTPS | El sitio va detrás de un proxy/CDN | Usa la redirección «detrás de proxy» del `.htaccess` |
