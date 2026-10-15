# C-ROTULUS S.U.R.L. — Sitio web corporativo

Sitio web 100 % estático (HTML5, CSS3 y JavaScript vanilla) para C-ROTULUS S.U.R.L.,
empresa de servicios tecnológicos. Consta de una **portada** (`index.html`, navegación
por anclas) y una página **Empresa** (`empresa.html`). El frontend no usa frameworks,
ni Node, ni paso de compilación: se sube tal cual a `public_html` de cualquier hosting
compartido. Además incluye un **backend opcional en PHP** (sin dependencias externas)
para el panel de administración, el formulario y la edición de contenido. Si no se usa
PHP, la web estática funciona igual.

> **¿Vas a publicarlo?** Sigue la **[Guía de despliegue (DEPLOY.md)](DEPLOY.md)**:
> desde subir los archivos por FTP hasta un VPS con Nginx, copias automáticas y CDN.
> Incluye un diagnóstico (`php app/preflight.php`) que comprueba el hosting.
> Si tu hosting es **Raiola Networks**, hay una guía propia paso a paso:
> **[DEPLOY-RAIOLA.md](DEPLOY-RAIOLA.md)** (cPanel + LiteSpeed + Cloudflare).

## Estructura

```
index.html               Portada (landing) con navegación por anclas
empresa.html             Página "Empresa": Sobre nosotros (historia, misión, visión, valores) y Equipo
css/styles.css           Estilos mobile-first (paleta de marca en :root)
js/main.js               Interactividad en JS vanilla
.htaccess                Reglas de Apache (caché, seguridad, protección de carpetas)
robots.txt / sitemap.xml SEO
DEPLOY.md                Guía de despliegue (básico → avanzado)
DEPLOY-RAIOLA.md         Guía específica para Raiola Networks (cPanel + LiteSpeed)
404.html                 Página de error personalizada (activa en .htaccess)
app/preflight.php        Diagnóstico previo al despliegue (CLI o web con clave)
deploy/
  config.local.example.php  Plantilla de config de producción (cópiala a app/config.local.php)
  deploy.sh                 Despliegue por SSH/rsync (nivel avanzado)
  cron/backup.php           Copia de seguridad de la BD (MySQL/SQLite)
  nginx/nginx.conf.example  Config de Nginx para VPS
  raiola/                   Kit específico de Raiola (.htaccess, config de ejemplo)
tools/build_zip.py       Regenera el paquete limpio para subir al hosting
assets/img/
  logo.png               Logo original (referencia)
  logo-header.png        Logo para cabecera (fondo transparente)
  logo-footer.png        Logo para el pie (sobre fondo oscuro)
  favicon.png            Favicon basado en el logo
  og-image.png           Imagen de vista previa para redes (1200x630)
  hero-tech.svg          Ilustración de portada: transformación digital (marcador reemplazable)
  equipo.svg             Ilustración "Sobre nosotros" (marcador reemplazable)
  mapa.svg               Marcador de mapa          (reemplazable por iframe)
  proyecto-web.svg       Proyecto: desarrollo web  (reemplazable por foto)
  proyecto-ia.svg        Proyecto: automatización/IA (reemplazable por foto)
  proyecto-redes.svg     Proyecto: redes y seguridad (reemplazable por foto)
```

## Paleta de marca

Extraída del logo real: azul `#005AA5` (el "C-") y gris `#7A7A7A` (ROTULUS).
Se edita toda en un solo sitio, las variables `:root` al inicio de `css/styles.css`:

| Variable | Valor | Uso |
|---|---|---|
| `--color-primary` | `#005AA5` | Azul del logo (principal) |
| `--color-primary-dark` | `#003F7D` | Degradados y hovers |
| `--color-primary-soft` | `#EAF2FB` | Fondos suaves |
| `--color-accent` | `#00C2B8` | Acento turquesa (nodos del circuito) |
| `--color-heading` | `#7A7A7A` | Gris del logo: títulos grandes |
| `--color-ink` | `#1F2A37` | Textos de cuerpo |
| `--color-ink-soft` | `#6F6F6F` | Textos secundarios |
| pie de página | `#08243D` | Fondo del pie (azul oscuro) |

## Datos editables

Los datos reales están marcados con corchetes y hay que sustituirlos antes de publicar:
`[TELÉFONO]`, `[CORREO]`, `[DIRECCIÓN]`, `[CIUDAD]`, `[URL_...]`, `[AÑO DE FUNDACIÓN]`
(también en el JSON-LD `LocalBusiness` de la cabecera).

Aun así, **casi todo el texto del sitio se puede cambiar sin tocar el código**
desde el panel (`admin/settings.php`, pestaña **Textos**): portada, cifras de
confianza, cuerpo de «Sobre nosotros», cabeceras de cada sección y pie. La web
lee esos valores de la base de datos al cargar (vía `api/index.php?resource=settings`)
y, si el backend no responde, se queda con lo escrito en `index.html`.
Los valores por defecto viven en `app/config.php` (bloque `defaults`).

## Formulario

Envía al **backend propio incluido** (`api/contact.php`), que valida los datos en
el servidor, aplica protección CSRF, límite de envíos por IP y guarda cada mensaje
en la base de datos (visible en el panel de administración).

Si prefieres un servicio externo (Formspree, etc.), cambia el endpoint en los dos
sitios: el atributo `action` del `<form>` en `index.html` y la constante
`FORM_ENDPOINT` en `js/main.js`.

## Arranque local

```bash
# PHP 8 + extensión pdo_sqlite (o pdo_mysql). No hace falta instalar nada más:
php -S localhost:8000 -t .
# abre http://localhost:8000
```

### Servidor de vista previa en este entorno (solo desarrollo)

Este sandbox se **recrea entre sesiones** y solo persiste `/workspace`, así que PHP
puede desaparecer. Para que la web no deje de mostrarse hay un **PHP portátil** en
`/workspace/.php-runtime` y un script que lo sirve y lo vigila:

```bash
bash tools/serve.sh --ensure   # arranca en :12000 + vigilante en segundo plano
bash tools/serve.sh --watch    # vigilante en primer plano (revive cada 15 s)
```

Es idempotente y no crea servidores duplicados. `tools/` queda excluido del ZIP de
despliegue. En un hosting real **no hace falta**: PHP está siempre activo.

Sin configurar nada, el proyecto arranca con **SQLite** (archivo en `app/data/`)
y el correo en modo **log** (`app/data/mail.log`), ideal para probar.

# ============================================================================
#  BACKEND (PHP + base de datos) — deployment en hosting con dominio
# ============================================================================

## Qué incluye

```
api/          Endpoints JSON (contacto, autenticación, ajustes, contenido, salud)
admin/        Panel de administración (mensajes, contenido, ajustes, usuarios)
app/          Núcleo: config, bootstrap, lib/ (db, auth, security, mailer, ...)
app/schema.sql  Esquema de la base de datos para crear las tablas a mano
.htaccess     Reglas de Apache (protege app/ y fuerza HTTPS)
```

## Base de datos

El backend soporta **MySQL/MariaDB** (recomendado en hosting) y **SQLite** (sin
configuración, ideal para pruebas o hostings muy básicos). Se elige con
`db.driver` en `app/config.php`.

Las tablas se crean **solas** la primera vez que se abre el sitio:
`users`, `sessions`, `tokens`, `contact_messages`, `rate_limits`, `settings`,
`content_items`. Si tu proveedor no permite crear tablas en ejecucion, importa
`app/schema.sql` desde phpMyAdmin.

## Seguridad aplicada

- **Contraseñas**: hash con `password_hash()` (bcrypt) y política de longitud.
- **Sesiones**: cookie `HttpOnly`, `SameSite=Lax`, `Secure` bajo HTTPS; el token
  se guarda hasheado en la base de datos y se rota al iniciar sesión.
- **CSRF**: cada formulario (web y panel) lleva un token; el JS lo pide a
  `api/index.php?action=csrf`. Las peticiones sin token se rechazan.
- **Fuerza bruta**: limite de intentos de login y de envios del formulario por IP.
- **Entradas**: validación y saneado en servidor; el contenido dinámico se escapa
  en el navegador (defensa XSS). El campo del mapa solo admite URLs `https://`.
- **Anti-spam**: campo trampa (`_gotcha`) y limite por IP.
- **Acceso al panel**: solo usuarios con `role = admin`. El **primer usuario**
  registrado se convierte en administrador automáticamente.

## Autenticación

- **Correo + contraseña** con verificación por enlace y recuperación de contraseña.
- **Google OAuth 2.0** (boton "Continuar con Google").
- Para activar Google: crea credenciales en Google Cloud Console y rellena
  `google.client_id` y `google.client_secret` en `app/config.php`.
  URI de redireccion autorizada:
  `https://TU-DOMINIO/api/auth.php?action=google_callback`

  *Ruta rápida:* entra en **Ajustes** del panel. Si Google aún no está configurado,
  verás la URI de redirección exacta lista para copiar en Google Cloud. Al pegar
  `client_id` y `client_secret` en `app/config.php` (o en `app/config.local.php`),
  el botón «Continuar con Google» aparece solo en la pantalla de acceso.

## Correo real (envío de verificación y avisos)

El formulario de contacto **envía el aviso a `crotulus.mipyme@gmail.com`**
(ajuste «Correo que recibe los avisos»). Ese destino ya viene puesto por
defecto. Para que el envío salga de verdad solo falta la **contraseña de
aplicación de Gmail**: el resto (SMTP de Gmail, puerto 587, usuario y destino)
ya está configurado.

El modo de envío se elige en `app/config.php`, apartado `mail`:

| `transport` | Qué hace | Cuándo usarlo |
|---|---|---|
| `log` | No envía; escribe en `app/data/mail.log` | Pruebas locales |
| `mail` | Usa la función `mail()` del hosting | Hosting sencillo |
| `smtp` | Conecta a tu servidor SMTP (con TLS/SSL y autenticación) | **Recomendado** |

Para correo real, pon `transport` a `smtp` y rellena `smtp_host`, `smtp_port`,
`smtp_user`, `smtp_pass` y `smtp_secure` (`tls` en el 587, `ssl` en el 465).
Después, en **Ajustes**, pulsa **«Enviar correo de prueba»** para comprobar que
funciona sin esperar a un registro real. Ejemplo con Gmail:

```php
'mail' => [
    'transport'   => 'smtp',
    'from_email'  => 'crotulus.mipyme@gmail.com', // o vacío = usa smtp_user
    'from_name'   => 'C-ROTULUS',
    'to_email'    => 'crotulus.mipyme@gmail.com', // quién recibe los avisos
    'smtp_host'   => 'smtp.gmail.com',
    'smtp_port'   => 587,
    'smtp_user'   => 'crotulus.mipyme@gmail.com',
    'smtp_pass'   => 'contrasena-de-aplicacion', // Contraseña de aplicación de Google
    'smtp_secure' => 'tls',
],
```

> En Gmail/Google Workspace necesitas una **contraseña de aplicación** (no la de
> tu cuenta). Otros proveedores (IONOS, Hostinger, Outlook...) dan datos SMTP
> equivalentes en su panel.

> Nota técnica: el aviso se envía como HTML con el `<style>` en una sola línea.
> El mailer pliega las líneas largas al límite de 1000 bytes de SMTP
> (`mailer_fold_lines()`), porque servidores estrictos rechazan el mensaje con
> `500 Line too long` y el formulario diría «ok» sin que llegue el correo.

### Poner el correo a punto con Gmail (paso a paso)

1. En la cuenta de Gmail, activa la **verificación en dos pasos**:
   `myaccount.google.com/security`.
2. Crea una **contraseña de aplicación** en `myaccount.google.com/apppasswords`
   (16 caracteres). Cópiala; solo se muestra una vez.
3. Entra en el panel (`/admin/`), pestaña **Ajustes · Correo** y rellena:
   - Método de envío: **SMTP (recomendado)**
   - Servidor: `smtp.gmail.com` · Puerto `587` · Seguridad `STARTTLS`
   - Usuario SMTP: tu dirección completa de Gmail
   - Contraseña SMTP: la **contraseña de aplicación**
   - Correo que recibe los avisos: la dirección donde quieres los mensajes
     (por ejemplo, la misma de Gmail)
   - Correo del remitente (From): déjalo **vacío** o pon el mismo Gmail
     (Gmail exige que el remitente coincida con la cuenta autenticada)
4. Pulsa **«Guardar correo»** y luego **«Enviar correo de prueba»**. Verás
   *«Correo de prueba enviado…»* o el **motivo exacto** del fallo.
5. Haz una prueba real: envía el formulario de contacto de la web y comprueba
   que el aviso llega a la bandeja (revisa también *Spam* la primera vez).

**Errores frecuentes y qué significan**

| Mensaje | Causa | Solución |
|---|---|---|
| `535-5.7.8 Username and Password not accepted` | Se usó la contraseña normal, no la de aplicación | Genera una contraseña de aplicación |
| `550`/`553 From address not allowed` | El remitente no coincide con la cuenta Gmail | Deja «From» vacío o pon tu Gmail |
| `No se pudo conectar a smtp.gmail.com:587` | El hosting bloquea la salida SMTP | Usa el correo del propio hosting (`mail()`) o pide que abran el puerto |
| El aviso no llega aunque diga «enviado» | Fue a *Spam* o el destinatario está mal | Revisa Spam y el «Correo que recibe los avisos» |

## Valoraciones y reseñas de servicios y proyectos

Los clientes pueden puntuar con estrellas cada servicio y proyecto (1-5) y dejar
un comentario. Se guardan en tu base de datos y se moderan en el panel.

- **En la web** (sección *Valoraciones*): selector de qué valorar (empresa,
  servicio o proyecto), estrellas, nombre, correo opcional y opinión. Se muestra la
  media y el listado de reseñas aprobadas.
- **En el panel** (`/admin/reviews.php`): aprobar, rechazar o eliminar, con filtros
  por estado y contador de pendientes.
- **Ajustes** (`/admin/settings.php`): activar/desactivar el módulo, publicar
  automáticamente sin moderar, y elegir herramienta externa.
- **Trustpilot**: la vía fiable es el **widget oficial (TrustBox)**. En Ajustes pega
  el enlace de tu ficha y el *Business Unit ID*; la web muestra tus reseñas reales
  en la sección de valoraciones (carrusel o mini estrellas, a elegir).
  La nota media que ve el visitante combina tus valoraciones propias con las de
  Trustpilot. Opciones: `trustpilot`, `google` o `custom` (solo valoraciones propias).

  > Trustpilot bloquea (HTTP 403) la lectura automática de su web, por eso no se
  > rastrean las reseñas: el widget oficial es la forma correcta y sin API key.

- **Anti-abuso**: token CSRF, campo trampa y límite por IP (`review_rate_max`).

## Pasos para publicar en el hosting

1. Sube todo el contenido a `public_html` (FTP o el gestor de archivos).
2. Copia `app/config.php` a `app/config.local.php` y edita ahi:
   - datos de MySQL (`host`, `name`, `user`, `password`),
   - `site_url` con tu dominio (`https://www.c-rotulus.com`),
   - `security.app_key` con una cadena larga y aleatoria,
   - `mail` (SMTP de tu proveedor, o `mail` para usar `mail()`),
   - `google` si quieres el acceso con Google.
3. Asegura permisos de escritura en `app/data/` (solo si usas SQLite o modo log).
4. Entra en `https://TU-DOMINIO/admin/` y **registra el primer usuario** (será el
   administrador). Verifica el correo si el envío está configurado.
5. En el panel, revisa **Ajustes** (teléfono, correo, dirección, mapa, redes) y
   **Contenido** (servicios, proyectos, testimonios, FAQ, proceso).

> `app/config.local.php` **no** debe subirse a un repositorio público: contiene
> contraseñas. Ya está excluido en `.gitignore`.

## Mapa

En el panel, **Ajustes → Mapa**, pega la URL de *incrustacion* de Google Maps
(Compartir → Insertar un mapa → copia solo el `src` del iframe, debe empezar por
`https://www.google.com/maps/embed?...`). La web la carga automáticamente en la
sección de Contacto. También puedes poner un enlace "Como llegar" con
`google_maps_url`. Si lo dejas vacio, se muestra la imagen `assets/img/mapa.svg`.

## Panel de administración

El acceso al panel está enlazado desde la web pública: el enlace **Acceder** de
la cabecera y del pie apunta a `admin/login.php`. El panel comparte la identidad
visual del sitio (mismas tipografias, azul de marca y tarjetas).

| Sección | Qué hace |
|---|---|
| Mensajes | Bandeja con los mensajes del formulario (estado, borrado) |
| Contenido | CRUD de servicios, proyectos, testimonios, FAQ y proceso |
| Valoraciones | Modera las reseñas de servicios y proyectos (aprobar/rechazar/borrar) |
| Ajustes | Datos de contacto, mapa, redes, correo de prueba, valoraciones y Google |
| Textos | Portada, cifras, «Sobre nosotros», cabeceras de sección y pie (editables sin código) |
| Usuarios | Cuentas: activar, desactivar, cambiar rol y borrar |

**Acceso y contraseñas:**
- Iniciar sesión: `/admin/login.php` · Crear cuenta: `/admin/register.php`
- Recuperar contraseña: `/admin/forgot.php` (enlace válido 1 hora)
- Restablecer: `/admin/reset.php?token=...` (lo envia el correo)
- El primer usuario registrado se convierte automáticamente en administrador.

**Validaciones** (cliente en `admin/assets/admin-auth.js` y servidor en
`app/lib/validator.php` y `api/auth.php`, siempre las mismas reglas):
- Correo con formato válido y longitud máxima.
- Contraseña: mínimo `security.password_min` (8 por defecto) caracteres,
  con letra y número; medidor de fortaleza en el registro.
- Repetición de contraseña coincidente.
- Nombre entre 2 y 120 caracteres.
- Proteccion CSRF en todos los formularios y limite de intentos por IP
  (login, registro y recuperación).

## Vista previa local

```bash
php -S localhost:8000 -t .
# abre http://localhost:8000
```

## Pendiente antes de publicar

- Sustituir los datos `[...]` por los reales (o hacerlo desde el panel).
- Configurar MySQL y `security.app_key` en `app/config.local.php`.
- Configurar el correo (SMTP) para verificación y recuperación.
- Opcional: credenciales de Google OAuth y fotos reales en los proyectos.

## Notas de mantenimiento

- **Versionado de recursos (cache):** `index.html` carga `css/styles.css?v=20261013f` y `js/main.js?v=20261013f`. Al editar el CSS o el JS, sube ese número (p. ej. `?v=20261014`) para que los navegadores no usen la versión guardada en cache.
- **Panel:** `admin.css` y `admin-auth.js` usan la constante `APP_ASSET_VERSION` de `app/bootstrap.php`. Sube ese valor al editarlos para forzar la recarga.
- **Animacion de aparicion:** el contenido es visible por defecto; solo se anima cuando `js/main.js` anade la clase `.has-reveal-anim` a `<html>`. Si el JS no se ejecuta (o el navegador sirve uno antiguo), las secciones se ven igualmente, y hay una red de seguridad que revela todo tras unos segundos.
