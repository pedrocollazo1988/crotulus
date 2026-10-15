# C-ROTULUS S.U.R.L. — Sitio web corporativo

Sitio web de C-ROTULUS S.U.R.L., empresa de servicios tecnológicos, con un
**panel de administración** y una **API pública**. El sitio público sigue siendo
HTML/CSS/JS estático; el backend es **Next.js 15 (App Router) + Prisma +
PostgreSQL**, que se despliega de forma **nativa en Vercel** (sin PHP, sin
contenedores y sin plan Pro).

> **¿Vas a publicarlo en Vercel?** Sigue **[VERCEL.md](VERCEL.md)** (Neon +
> variables de entorno + migraciones). Para un hosting clásico con SSH/cPanel,
> **[DEPLOY.md](DEPLOY.md)**.

---

## Estructura

```
public/                     Sitio público estático (lo sirve Next tal cual)
  index.html                Portada (navegación por anclas)
  empresa.html              Página "Empresa" (historia, misión, visión, valores, equipo)
  css/styles.css            Estilos mobile-first (paleta de marca en :root)
  js/main.js                Interactividad en JS vanilla
  assets/img/               Logo, favicon, ilustraciones SVG, fotos
  assets/fonts/             Fuentes autoalojadas (Inter + Plus Jakarta Sans, woff2)
  admin/assets/             CSS y JS del panel (login/registro)
  robots.txt / sitemap.xml  SEO
  404.html                  Página de error

src/app/                    App Router de Next.js
  layout.tsx                Layout raíz
  api/                      API pública (route handlers)
    index/route.ts          ?resource=settings|content|blog|team|faqs|reviews|
                            google_reviews|trustpilot|testimonials|session
                            ?action=csrf|captcha  y  ?resource=health
    contact/route.ts        Formulario de contacto (CSRF + captcha + rate limit)
    auth/route.ts           Login, registro, Google OAuth, verificación, reset
    reviews/route.ts        Valoraciones de servicios/proyectos
    submissions/route.ts    Aportaciones de usuarios (testimonios y preguntas)
    verify/route.ts         Verificación de correo
    logout/route.ts         Cierre de sesión
  admin/                    Panel React (Server Actions)
    login/ register/ forgot/ reset/ account/
    page.tsx (mensajes)  content/ blog/ team/ reviews/ submissions/ settings/ users/

src/lib/                    Lógica del backend (una lib por módulo del PHP antiguo)
  db.ts                     Cliente Prisma (singleton)
  config.ts defaults.ts     Configuración y valores por defecto
  auth.ts session.ts        Usuarios y sesiones (cookie HttpOnly, token hasheado)
  csrf.ts captcha.ts        Anti-CSRF y captcha aritmético firmado (HMAC)
  rate-limit.ts             Límite por IP (upsert atómico en Postgres)
  settings.ts content.ts    Ajustes y contenido editable
  blog.ts team.ts faq.ts    Blog, equipo y FAQ ordenada por importancia
  reviews.ts submissions.ts Valoraciones y aportaciones de usuarios
  google-reviews.ts         Reseñas de Google Places (con caché)
  trustpilot.ts             Trustpilot (widget oficial)
  mailer.ts                 Correo (log / mail() / SMTP con Nodemailer)
  validator.ts http.ts      Validación y respuestas JSON

prisma/schema.prisma        Esquema PostgreSQL (13 modelos)
prisma/migrations/          Migraciones versionadas
scripts/seed.ts             Semilla (settings, contenido, blog, equipo, FAQ)
scripts/migrate-sqlite-to-pg.ts  Importa los datos del SQLite antiguo
tools/pgdev.sh              PostgreSQL portátil de desarrollo
tools/serve-next.sh         Vista previa local (Next + PG + vigilante)
legacy/                     Backend PHP + SQLite original (referencia, NO se despliega)
vercel.json                 Config de Vercel (framework, build, región, cabeceras)
```

---

## Arranque local

```bash
# 1. PostgreSQL portátil (se instala solo si hace falta)
bash tools/pgdev.sh --ensure        # escucha en 127.0.0.1:5432

# 2. Variables de entorno
cp .env.example .env.local          # rellena DATABASE_URL, DIRECT_URL, APP_KEY...

# 3. Dependencias y esquema
npm install
npx prisma migrate deploy           # crea las tablas
npm run db:seed                     # contenido de ejemplo (solo tablas vacías)

# 4. Servidor de desarrollo
npm run dev                         # http://localhost:12000
```

Atajos útiles:

| Comando | Qué hace |
|---|---|
| `npm run dev` | Next.js en modo desarrollo (puerto 12000) |
| `npm run build` | `prisma generate && next build` (producción) |
| `npm start` | Sirve el build de producción (puerto 12000) |
| `npm run typecheck` | Comprueba tipos TypeScript |
| `npm run db:push` | Sincroniza el esquema sin crear migración |
| `npm run db:seed` | Siembra datos (no pisa lo que ya exista) |
| `npm run db:migrate-sqlite -- <ruta.sqlite>` | Importa el SQLite antiguo |

### Vista previa en este entorno (solo desarrollo)

El sandbox se **recrea entre sesiones** y solo persiste `/workspace`, donde viven
el PostgreSQL portátil (`/workspace/.pg-runtime`) y `node_modules`. Para dejarlo
todo arrancado (con un vigilante que lo revive cada 15 s):

```bash
bash tools/serve-next.sh --ensure   # Postgres + Next en :12000 + vigilante
bash tools/serve-next.sh --watch    # vigilante en primer plano
bash tools/serve-next.sh --prod     # compila y arranca "next start"
```

Es idempotente (no crea servidores duplicados). `tools/` queda excluido de
Vercel. En producción **no hace falta**: Vercel arranca la app por su cuenta.

---

## Base de datos (PostgreSQL)

El esquema Prisma (`prisma/schema.prisma`) es una migración 1:1 de las tablas del
backend PHP, con mejoras que aprovecha Postgres:

| PHP (SQLite/MySQL) | PostgreSQL (Prisma) |
|---|---|
| `meta` TEXT (`json_encode`) | `Json` (JSONB) |
| `is_active` INT (0/1) | `Boolean` |
| `php_sessions` | se elimina (sesiones nativas de Next) |
| `rate_limits` (leer + escribir) | upsert atómico (`ON CONFLICT`) |

Tablas: `users`, `sessions`, `tokens`, `contact_messages`, `rate_limits`,
`settings`, `content_items`, `user_submissions`, `reviews`, `blog_posts`,
`team_members`, `google_reviews`, `audit_log`.

- **Neon (producción):** usa la cadena del **pooler** en `DATABASE_URL` y la
  directa en `DIRECT_URL` (ver [VERCEL.md](VERCEL.md)).
- **Local:** `tools/pgdev.sh` crea el clúster con usuario `crotulus`, base
  `crotulus`, en `/workspace/.pg-runtime`.

### Importar los datos del SQLite antiguo

```bash
npm run db:migrate-sqlite -- legacy/app/data/c-rotulus.sqlite
```

Conserva los IDs originales, convierte `meta` a JSONB y reajusta las secuencias
(`setval`) para que los `INSERT` nuevos no choquen. Es idempotente: omite las
tablas que ya tienen filas (`--force` para reimportar). No migra `sessions` ni
`tokens` (son efímeros).

---

## Datos editables (sin tocar código)

Casi todo el texto del sitio se cambia desde el panel
(`/admin/settings`, pestaña **Textos**): portada, cifras de confianza, cuerpo de
«Sobre nosotros», cabeceras de cada sección y pie. La web lee esos valores de la
base de datos al cargar (`/api/index?resource=settings`) y, si el backend no
responde, se queda con lo escrito en `index.html`.

Los valores por defecto viven en `src/lib/defaults.ts`. Los datos reales de
contacto (teléfono, correo, dirección, redes) están en la tabla `settings` y se
editan en **Ajustes · Contacto**.

---

## Formulario de contacto

`POST /api/contact` valida en el servidor, aplica **CSRF**, **captcha** propio,
campo trampa (`_gotcha`) y **límite por IP**, y guarda cada mensaje en
`contact_messages` (visible en el panel). El aviso por correo sale según la
configuración `MAIL_*`.

---

## Seguridad aplicada

- **Contraseñas:** hash con bcrypt (`bcryptjs`) y política de longitud.
- **Sesiones:** cookie `HttpOnly`, `SameSite=Lax`, `Secure` bajo HTTPS; el token
  se guarda **hasheado** en la base de datos y se rota al iniciar sesión.
- **CSRF:** cada formulario lleva un token (`/api/index?action=csrf`); las
  peticiones sin token se rechazan.
- **Fuerza bruta:** límite de intentos de login y de envíos por IP
  (`rate_limits`, upsert atómico).
- **Captcha:** reto aritmético firmado con HMAC (`APP_KEY`) y caducidad.
- **Entradas:** validación y saneado en servidor; el contenido dinámico se escapa
  (defensa XSS). El campo del mapa solo admite URLs `https://`.
- **Acceso al panel:** solo usuarios con `role = admin`. El **primer usuario**
  registrado se convierte en administrador automáticamente.
- **Cabeceras:** `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy` y `Cross-Origin-Opener-Policy` (en `next.config.mjs`).

---

## Autenticación

- **Correo + contraseña** con verificación por enlace y recuperación de contraseña.
- **Google OAuth 2.0** (botón «Continuar con Google»).
- Para activar Google: crea credenciales en Google Cloud Console y define
  `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. URI de redirección:
  `https://TU-DOMINIO/api/auth?action=google_callback`.
  Si Google no está configurado, **Ajustes · Google** muestra la URI exacta para
  copiar y el botón aparece desactivado hasta rellenar las credenciales.

---

## Correo

El formulario de contacto envía el aviso a `MAIL_TO` (por defecto
`crotulus.mipyme@gmail.com`). El modo de envío se elige con `MAIL_TRANSPORT`:

| `MAIL_TRANSPORT` | Qué hace | Cuándo usarlo |
|---|---|---|
| `log` | No envía; escribe en `app-data/mail.log` | Pruebas locales |
| `mail` | Usa la función `mail()` del sistema | Hosting sencillo |
| `smtp` | Conecta a tu servidor SMTP (TLS/SSL + auth) | **Recomendado** |

Para correo real, pon `MAIL_TRANSPORT=smtp` y rellena `MAIL_SMTP_HOST`,
`MAIL_SMTP_PORT`, `MAIL_SMTP_USER`, `MAIL_SMTP_PASS` y `MAIL_SMTP_SECURE`
(`tls` en 587, `ssl` en 465). Luego pulsa **«Enviar correo de prueba»** en
**Ajustes · Correo** para comprobar el envío sin esperar a un registro real.

> En Gmail/Google Workspace necesitas una **contraseña de aplicación** (no la de
> tu cuenta). Otros proveedores dan datos SMTP equivalentes en su panel.

**Errores frecuentes**

| Mensaje | Causa | Solución |
|---|---|---|
| `535-5.7.8 Username and Password not accepted` | Se usó la contraseña normal | Genera una contraseña de aplicación |
| `550`/`553 From address not allowed` | El remitente no coincide con la cuenta | Deja `MAIL_FROM_NAME`/from vacío o pon tu Gmail |
| No se pudo conectar a `smtp...:587` | El hosting bloquea la salida SMTP | Usa el correo del propio hosting o abre el puerto |
| El aviso no llega aunque diga «enviado» | Fue a *Spam* o el destino está mal | Revisa Spam y `MAIL_TO` |

---

## Valoraciones, reseñas y aportaciones

- **Valoraciones propias** (`reviews`): los clientes puntúan servicios y proyectos
  (1-5 + comentario). Se moderan en `/admin/reviews`.
- **Reseñas de Google** (`google_reviews`): se leen de Google Places API y se
  cachean en la BD (`/api/index?resource=google_reviews`). Sin credenciales, la
  web conserva las reseñas de ejemplo del HTML.
- **Trustpilot**: la vía fiable es el **widget oficial (TrustBox)**. En Ajustes se
  pega el enlace de la ficha y el *Business Unit ID*.
- **Aportaciones** (`user_submissions`): testimonios y preguntas que envían los
  visitantes; se moderan en `/admin/submissions`. Las FAQ se ordenan por
  importancia (peso manual + cuántos preguntaron lo mismo).

---

## Panel de administración

El enlace **Acceder** de la cabecera y del pie apunta a `/admin/login`. El panel
comparte la identidad visual del sitio.

| Sección | Qué hace |
|---|---|
| Mensajes | Bandeja con los mensajes del formulario (estado, borrado) |
| Contenido | CRUD de servicios, proyectos, testimonios, FAQ y proceso |
| Blog | Artículos (título, slug, extracto, cuerpo, categoría, autor, imagen) |
| Equipo | Miembros (nombre, cargo, biografía, contacto, avatar) |
| Valoraciones | Modera las reseñas (aprobar/rechazar/borrar) |
| Aportaciones | Modera testimonios y preguntas de los usuarios |
| Ajustes | Contacto, textos, correo de prueba, reseñas, seguridad, Google, rutas |
| Usuarios | Cuentas: activar, desactivar, cambiar rol y borrar |

- Iniciar sesión: `/admin/login` · Crear cuenta: `/admin/register`
- Recuperar contraseña: `/admin/forgot` · Restablecer: `/admin/reset?token=...`
- El primer usuario registrado se convierte en administrador.

**Validaciones** (cliente y servidor, siempre las mismas reglas):
correo válido, contraseña con mínimo de caracteres + letra + número, repetición
coincidente, nombre de 2 a 120 caracteres, CSRF y límite de intentos por IP.

---

## Compatibilidad de URLs

`next.config.mjs` reescribe las rutas `.php` antiguas a las nuevas, para no tocar
`public/js/main.js`: `api/index.php → /api/index`, `api/contact.php → /api/contact`,
`admin/login.php → /admin/login`, etc. Las URLs limpias `/` y `/empresa` también
están declaradas.

---

## Paleta y tipografías

Paleta oficial del cliente (idéntica en `public/css/styles.css` y
`public/admin/assets/admin.css`):

| Variable | Valor | Uso |
|---|---|---|
| `--color-primary` | `#136493` | Azul petróleo (principal) |
| `--color-primary-dark` | `#0E4E75` | Degradados y hovers |
| `--color-primary-soft` | `#E7F1F8` | Fondos suaves |
| `--color-navy` | `#0B2E45` | Fondos oscuros (hero, pie) |
| `--color-accent` | `#2E86B8` | Azul de acento |
| `--color-ice` | `#C5E2F2` | Azul hielo (texto claro sobre azul) |
| `--color-steel` | `#BDBDBD` | Gris neutro (bordes, placa) |

Tipografías autoalojadas en `public/assets/fonts/` (sin Google Fonts ni CDN):
**Inter** para el cuerpo e **Plus Jakarta Sans** para los titulares.

---

## Notas de mantenimiento

- **Caché de recursos:** `index.html` carga `css/styles.css?v=...` y
  `js/main.js?v=...`. Al editar el CSS o el JS, sube ese número para que los
  navegadores no usen la versión guardada.
- **Animación de aparición:** el contenido es visible por defecto; solo se anima
  cuando `js/main.js` añade `.has-reveal-anim` a `<html>`. Si el JS no se ejecuta,
  las secciones se ven igualmente.
- **Backend PHP antiguo:** vive en `legacy/` como referencia. No se ejecuta ni se
  despliega; se conserva para consultar la paridad de comportamiento.
