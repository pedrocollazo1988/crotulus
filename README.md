# C-ROTULUS S.U.R.L. — Sitio web corporativo

Landing page 100 % estática (HTML5, CSS3 y JavaScript vanilla) para C-ROTULUS S.U.R.L.,
empresa de servicios tecnológicos. Sin frameworks, sin Node, sin backend y sin paso de
compilación: se sube tal cual a `public_html` de cualquier hosting compartido.

## Estructura

```
index.html               Landing única con navegación por anclas
css/styles.css           Estilos mobile-first (paleta de marca en :root)
js/main.js               Interactividad en JS vanilla
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
    'from_email'  => 'no-reply@tudominio.com',
    'from_name'   => 'C-ROTULUS',
    'smtp_host'   => 'smtp.gmail.com',
    'smtp_port'   => 587,
    'smtp_user'   => 'tucuenta@gmail.com',
    'smtp_pass'   => 'contrasena-de-aplicacion', // Contraseña de aplicación de Google
    'smtp_secure' => 'tls',
],
```

> En Gmail/Google Workspace necesitas una **contraseña de aplicación** (no la de
> tu cuenta). Otros proveedores (IONOS, Hostinger, Outlook...) dan datos SMTP
> equivalentes en su panel.

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
