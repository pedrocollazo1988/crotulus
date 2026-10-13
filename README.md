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
  hero-tech.svg          Ilustración de portada   (marcador reemplazable)
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
# PHP 8 + extensión pdo_sqlite (o pdo_mysql). No hace falta instalar nada mas:
php -S localhost:8000 -t .
# abre http://localhost:8000
```

Sin configurar nada, el proyecto arranca con **SQLite** (archivo en `app/data/`)
y el correo en modo **log** (`app/data/mail.log`), ideal para probar.

# ============================================================================
#  BACKEND (PHP + base de datos) — deployment en hosting con dominio
# ============================================================================

## Que incluye

```
api/          Endpoints JSON (contacto, autenticacion, ajustes, contenido, salud)
admin/        Panel de administracion (mensajes, contenido, ajustes, usuarios)
app/          Nucleo: config, bootstrap, lib/ (db, auth, security, mailer, ...)
app/schema.sql  Esquema de la base de datos para crear las tablas a mano
.htaccess     Reglas de Apache (protege app/ y fuerza HTTPS)
```

## Base de datos

El backend soporta **MySQL/MariaDB** (recomendado en hosting) y **SQLite** (sin
configuracion, ideal para pruebas o hostings muy basicos). Se elige con
`db.driver` en `app/config.php`.

Las tablas se crean **solas** la primera vez que se abre el sitio:
`users`, `sessions`, `tokens`, `contact_messages`, `rate_limits`, `settings`,
`content_items`. Si tu proveedor no permite crear tablas en ejecucion, importa
`app/schema.sql` desde phpMyAdmin.

## Seguridad aplicada

- **Contrasenas**: hash con `password_hash()` (bcrypt) y politica de longitud.
- **Sesiones**: cookie `HttpOnly`, `SameSite=Lax`, `Secure` bajo HTTPS; el token
  se guarda hasheado en la base de datos y se rota al iniciar sesion.
- **CSRF**: cada formulario (web y panel) lleva un token; el JS lo pide a
  `api/index.php?action=csrf`. Las peticiones sin token se rechazan.
- **Fuerza bruta**: limite de intentos de login y de envios del formulario por IP.
- **Entradas**: validacion y saneado en servidor; el contenido dinamico se escapa
  en el navegador (defensa XSS). El campo del mapa solo admite URLs `https://`.
- **Anti-spam**: campo trampa (`_gotcha`) y limite por IP.
- **Acceso al panel**: solo usuarios con `role = admin`. El **primer usuario**
  registrado se convierte en administrador automaticamente.

## Autenticacion

- **Correo + contrasena** con verificacion por enlace y recuperacion de contrasena.
- **Google OAuth 2.0** (boton "Continuar con Google").
- Para activar Google: crea credenciales en Google Cloud Console y rellena
  `google.client_id` y `google.client_secret` en `app/config.php`.
  URI de redireccion autorizada:
  `https://TU-DOMINIO/api/auth.php?action=google_callback`

## Pasos para publicar en el hosting

1. Sube todo el contenido a `public_html` (FTP o el gestor de archivos).
2. Copia `app/config.php` a `app/config.local.php` y edita ahi:
   - datos de MySQL (`host`, `name`, `user`, `password`),
   - `site_url` con tu dominio (`https://www.c-rotulus.com`),
   - `security.app_key` con una cadena larga y aleatoria,
   - `mail` (SMTP de tu proveedor, o `mail` para usar `mail()`),
   - `google` si quieres el acceso con Google.
3. Asegura permisos de escritura en `app/data/` (solo si usas SQLite o modo log).
4. Entra en `https://TU-DOMINIO/admin/` y **registra el primer usuario** (sera el
   administrador). Verifica el correo si el envio esta configurado.
5. En el panel, revisa **Ajustes** (telefono, correo, direccion, mapa, redes) y
   **Contenido** (servicios, proyectos, testimonios, FAQ, proceso).

> `app/config.local.php` **no** debe subirse a un repositorio publico: contiene
> contrasenas. Ya esta excluido en `.gitignore`.

## Mapa

En el panel, **Ajustes → Mapa**, pega la URL de *incrustacion* de Google Maps
(Compartir → Insertar un mapa → copia solo el `src` del iframe, debe empezar por
`https://www.google.com/maps/embed?...`). La web la carga automaticamente en la
seccion de Contacto. Tambien puedes poner un enlace "Como llegar" con
`google_maps_url`. Si lo dejas vacio, se muestra la imagen `assets/img/mapa.svg`.

## Panel de administracion

| Seccion | Que hace |
|---|---|
| Mensajes | Bandeja con los mensajes del formulario (estado, borrado) |
| Contenido | CRUD de servicios, proyectos, testimonios, FAQ y proceso |
| Ajustes | Datos de contacto, mapa, redes sociales |

## Vista previa local

```bash
php -S localhost:8000 -t .
# abre http://localhost:8000
```

## Pendiente antes de publicar

- Sustituir los datos `[...]` por los reales (o hacerlo desde el panel).
- Configurar MySQL y `security.app_key` en `app/config.local.php`.
- Configurar el correo (SMTP) para verificacion y recuperacion.
- Opcional: credenciales de Google OAuth y fotos reales en los proyectos.

## Notas de mantenimiento

- **Versionado de recursos (cache):** `index.html` carga `css/styles.css?v=20261013` y `js/main.js?v=20261013`. Al editar el CSS o el JS, sube ese numero (p. ej. `?v=20261014`) para que los navegadores no usen la version guardada en cache.
- **Animacion de aparicion:** el contenido es visible por defecto; solo se anima cuando `js/main.js` anade la clase `.has-reveal-anim` a `<html>`. Si el JS no se ejecuta (o el navegador sirve uno antiguo), las secciones se ven igualmente, y hay una red de seguridad que revela todo tras unos segundos.
