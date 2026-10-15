# AGENTS.md — Notas del proyecto C-ROTULUS

Sitio corporativo estatico (HTML/CSS/JS vanilla) + panel PHP de administracion.

## ⚠️ Arranque automatico del servidor de vista previa (LEER PRIMERO)

Este entorno se **recrea entre sesiones**: desaparecen PHP (`/usr`), `.bashrc`
(`/home`) y los procesos. Solo persiste `/workspace`, donde vive un **PHP portatil**
autonomo (`/workspace/.php-runtime`). **Al iniciar cualquier conversacion, ejecuta:**

```bash
bash tools/serve.sh --ensure
```

Eso levanta (o deja ya levantado) el servidor en `0.0.0.0:12000` **y ademas deja un
vigilante en segundo plano** que lo revive cada 15 s si se cae. Sin duplicados (flock)
y sin volver a instalar nada: usa el PHP portatil de `/workspace`.
Si solo quieres el vigilante en primer plano: `bash tools/serve.sh --watch`.
Detalle completo en la seccion "Servidor de vista previa que se apaga" (abajo).

## Arquitectura

- `index.html` — landing publica (una sola pagina, anclas + scroll suave).
- `css/styles.css`, `js/main.js` — estilos y comportamiento del sitio publico.
- `assets/img/` — logo, favicon, ilustraciones (SVG). Mantener permisos `644`.
- `admin/` — panel (login, register, forgot, reset, index/mensajes, content, settings, users).
- `admin/assets/admin.css`, `admin/assets/admin-auth.js` — UI y validacion del panel.
- `api/auth.php`, `api/contact.php`, `api/verify.php`, `api/index.php` — endpoints.
- `app/bootstrap.php` — constantes (`APP_ASSET_VERSION`) y arranque.
- `app/lib/` — `helpers.php` (`url()`, `site_base_url()`), `security.php`, `validator.php`, `auth.php`, `settings.php`.
- `app/config.php` / `app/config.local.php` — configuracion (local no se versiona).

## Convenciones

- Textos de cara al usuario en espanol con acentos y enie correctos; identificadores
  (ids, names, claves de BD) SIN acentos por seguridad.
- Codigo PHP: `declare(strict_types=1)` implicito del proyecto, salida escapada con `e()`.
- Todos los recursos (`css`, `js`, `admin.css`, `admin-auth.js`) se referencian con
  `?v=APP_ASSET_VERSION`. Subir ese valor en `app/bootstrap.php` al tocar assets del panel.
  En `index.html` la version es literal (`?v=20261013f`); subirla al tocar CSS/JS del sitio.

## Cache-busting del sitio publico (IMPORTANTE)

Si un cambio en `js/main.js` o `css/styles.css` "no se ve", casi siempre es cache del
navegador. Solucion: subir el `?v=` en `index.html` (y en `README.md`). No es un bug del JS.

## Bug resuelto: JS del panel no interceptaba el submit

Causa raiz: `site_base_url()` en `app/lib/helpers.php` solo miraba `$_SERVER['HTTPS']`.
Tras un proxy/CDN TLS (p. ej. el runtime de desarrollo) `HTTPS` esta vacio y si llega
`X-Forwarded-Proto: https`, asi que el HTML generaba `http://...admin-auth.js` desde una
pagina `https://` -> mixed content -> el navegador bloqueaba el script y el formulario
se enviaba de forma nativa. Se corrigio detectando `X-Forwarded-Proto`, `X-Forwarded-SSL`
y el puerto 443, igual que ya hacia `security_start_session()`.

## Bug resuelto: excepcion en setupActiveLink (main.js)

`setupActiveLink()` pasaba el `href` de TODOS los `.nav-link` a `querySelector`; el enlace
"Acceder" (`admin/login.php`) no es un selector valido y lanzaba `SyntaxError`, abortando el
resto de `init()` (incluido el formulario de contacto). Se filtran solo los enlaces de ancla
(`#...`) y se protege `setupSmoothScroll` con `try/catch`.

## Depuracion headless (sin playwright instalado)

Hay Chromium en `/usr/bin/chromium`. Para comprobar JS real en el navegador se usa CDP con
Node (`WebSocket` nativo) y `--user-data-dir` nuevo por ejecucion para evitar cache.
Los formularios del panel llevan `novalidate` para que los mensajes salgan del JS
(validacion nativa y validacion propia no se pisan).

## Pruebas manuales utiles (curl)

```
curl -s -o /dev/null -w "%{http_code}\n" https://<host>/index.html
curl -s "https://<host>/admin/login.php" | grep -o '<script src="[^"]*"'
```
Comprobar que el esquema de los `<script src>` coincide con el de la pagina (https).

## Bug resuelto: la sesion no persistia (CSRF caducaba) tras un balanceador

Sintoma: cualquier POST con CSRF (`login`, `contact`, `reviews`) fallaba con
"Token de seguridad invalido o caducado", aunque el token se pidiera antes.

Causa raiz: `security_start_session()` ataba la sesion a la IP del visitante
(`hash(client_ip() . '|' . user_agent)`) y la comparaba en cada peticion. Detras de
una plataforma con varias IPs de salida (el runtime de desarrollo, balanceadores, CDN),
`client_ip()` cambia entre peticiones -> el fingerprint no coincide -> se destruye la
sesion y con ella el token CSRF. Se confirmo midiendo `client_ip()` en peticiones
sucesivas (10.2.72.2 -> 10.2.22.2 -> ...).

Arreglo: nuevo ajuste `security.session_bind_ip` (por defecto `false`). La sesion se
ata solo al `User-Agent`; la IP solo cuenta si se activa el ajuste (hosting de una sola
maquina). Alternativa mejor para hosts con proxy: rellenar `security.trusted_proxies`.

## Opiniones (reseñas de Google)

- La seccion `#valoraciones` del front es ahora **«Opiniones»**: tres reseñas
  reales de la ficha de Google (nombre + estrellas + texto) y un botón
  «Ver todas en Google». Es contenido estático editable en `index.html`
  (marcadores `[RESEÑA_1_*]`, `[RESEÑA_2_*]`, `[RESEÑA_3_*]`, `[NOTA_MEDIA]`,
  `[Nº_RESENAS]`), pensado para pegar reseñas reales de Google.
- El enlace del botón usa el marcador `[URL_GOOGLE_REVIEWS]` y se rellena desde
  el ajuste `google_reviews_url` (Ajustes · Reseñas · «Enlace a tu ficha en
  Google») mediante `setupGoogleReviewsLink()` en `js/main.js`.
- Nota: la infraestructura de valoraciones propias (`reviews`, `api/reviews.php`,
  `admin/reviews.php`, Trustpilot) sigue existiendo en el backend, pero ya no se
  muestra en la portada. Si se quiere volver a activar el formulario de
  valoraciones, habría que reponer su bloque en `index.html` y la lógica
  `setupReviews`/`cargarValoraciones`/`setupTrustpilot` en `js/main.js`.

### Trustpilot (backend, ya no en portada)

Trustpilot devuelve **403 (Cloudflare)** a las peticiones del servidor, asi que
`trustpilot_fetch()` (best-effort, JSON-LD) casi nunca obtiene datos. La via fiable
es el **widget oficial (TrustBox)**: el panel pide el *Business Unit ID* y el
`trustpilot_template` (`carrusel` por defecto o `estrellas`); `setupTrustpilot()`
inyecta el script de Trustpilot y muestra las resenas reales. El boton
«Actualizar resenas de Trustpilot» en Ajustes solo refresca la cache del intento.

### Contenido inicial (seed)

`db_init()` llama a `seed_defaults()` y a `seed_content()`. `seed_content()` rellena
`content_items` (servicios, proyectos, testimonios, proceso, FAQ) **solo si la tabla
esta vacia**, para que la web se alimente de la base de datos y el panel la gestione.
Los testimonios, por tanto, se renderizan desde la BD (`loadContent` en el front).

### Boton de Google siempre visible

En `admin/login.php` y `admin/register.php` el bloque de Google se muestra siempre:
si `google_enabled()` es falso, se pinta un `.btn-google.is-disabled` (no clicable)
para que la opcion se vea desde el principio; se activa al rellenar las credenciales.

## Correo real y Google OAuth (configuracion)

- Correo: `app/config.php` -> `mail`. `transport` admite `log` (pruebas), `mail`
  (funcion del hosting) o `smtp` (recomendado; socket propio, sin dependencias).
  Boton de prueba en `/admin/settings.php` ("Enviar correo de prueba").
  **Los avisos del formulario de contacto van a `crotulus.mipyme@gmail.com`**
  (`mail.to_email` / ajuste `mail_to_email`, ya configurado por defecto junto con
  SMTP de Gmail en el puerto 587). Falta unicamente `smtp_pass` = contrasena de
  aplicacion de Google; sin ella Gmail responde `535 BadCredentials` y el aviso no sale.
  Circuito verificado de extremo a extremo contra un servidor SMTP de prueba local.
  OJO: el cuerpo HTML lleva el `<style>` en una sola linea; hay que plegar las
  lineas largas (`mailer_fold_lines()`, limite SMTP de 1000 bytes) o servidores
  estrictos responden `500 Line too long` y el aviso no sale aunque el formulario diga OK.
- Google: `app/config.php` -> `google` (`client_id`, `client_secret`, `redirect_uri`).
  `google_enabled()` = `client_id` no vacio. Si esta vacio, el boton no aparece y
  `/admin/settings.php` muestra la URI exacta que hay que registrar en Google Cloud.
  El callback de Google depende del `state` en sesion (por eso el bug de sesion de
  arriba tambien rompia el login con Google).


## Aportaciones de usuarios (testimonios y preguntas) y valoraciones

- Todo lo que aporta el visitante exige cuenta registrada: `api/contact.php`, `api/reviews.php` y `api/submissions.php` llaman a `require_user()`. Sin sesion devuelven {"ok":false,"error":"Inicia sesión para continuar."}.
- `api/submissions.php` guarda en `user_submissions` (tipos testimonio y pregunta) con estado pendiente o aprobada segun `submissions_auto_approve`. El panel los modera en `admin/submissions.php`.
- El front (`js/main.js` -> `setupAuthGate`) consulta `?resource=session`; si hay sesion muestra los formularios con `[data-requires-login]` y oculta los avisos `[data-login-prompt]`.
- El enlace de cabecera (`#navAuthLink`) cambia entre "Acceder" y "Mi cuenta".

## Orden de las FAQ por importancia

- `app/lib/faq.php` combina el peso manual (`content_items.score`, 0-5, editable en `admin/content.php`) y el numero de usuarios que preguntaron lo mismo (`user_submissions` tipo pregunta, emparejadas por titulo normalizado).
- El endpoint publico `?resource=faqs` devuelve las FAQ ya ordenadas. La portada (`cargarRankingFaq`) rellena `#accordion[data-faq-ranked]`. NO marcar ese div con `data-content-list="faq"` a la vez, o las dos cargas compiten y se pierde el orden.
- En `seed_content()` las FAQ de ejemplo llevan un 4o valor (score de importancia).

## Ajustes del sitio (admin/settings.php)

- Página solo para administradores con pestañas: General, Contacto, Correo, Reseñas,
  Aportaciones, Seguridad, Google y Rutas. La pestaña activa se recuerda vía `#ancla`
  en la URL (JS puro, sin recargar).
- Los valores viven en la tabla `settings` y tienen prioridad sobre `app/config.php`
  (`app/bootstrap.php` los aplica con `settings_config_map()`).
- `settings_editable()` define qué campos se pueden guardar; `settings_checkboxes()`
  qué claves son casillas; `settings_secret_keys()` las que se enmascaran (`********`)
  y nunca se devuelven al front.
- **Ámbito de casillas**: cada formulario incluye un campo oculto
  `_checkboxes="clave1,clave2"`. Solo se guardan las casillas declaradas en ese
  ámbito, para que guardar una pestaña no desactive las de las demás. Si añades una
  casilla nueva, inclúyela también en el `_checkboxes` de su formulario.
- `site_name` y `site_url` NO están en `defaults` (se sembrarían sobre la config y
  romperían el preview apuntando al dominio de producción). Se exponen desde la config
  en `settings_all()` y solo se escriben en la BD cuando el admin los guarda.
- La API pública (`settings_public()`, lista blanca) no expone credenciales,
  ajustes de seguridad ni rutas internas. Integración en el front:
  `js/main.js` -> `aplicarAjustes()` (datos), `aplicarSeo()` (title/meta/OG),
  `mostrarMantenimiento()` y `cargarAnalytics()` (GA4 solo si hay `analytics_id`).
- Correo real en pruebas: Gmail vía SMTP (contraseña de aplicación), transport `smtp`.

## Cabecera pública

- Menú principal centrado en escritorio con rejilla `1fr auto 1fr` en `.site-header`.
  "Acceder"/"Mi cuenta" (`.nav-link--auth`) queda separado. En móvil, menú hamburguesa.

## Notas de UI (portada y acceso)

- Logo de cabecera: `.brand` es un "plato" blanco (fondo `#fff`, `border-radius:12px`,
  sombra suave) que replica el logo de la página de acceso (`.auth-aside__logo` en
  `admin/assets/admin.css`). `.brand__img` mide 40px de alto (44px en ≥860px, 52px
  en ≥900px). El `<img>` de index.html lleva `width="226" height="85"` para reservar
  espacio y evitar saltos de layout (CLS). El logo del pie es otra instancia más pequeña.
  OJO: `img{max-width:100%}` colapsa la columna `1fr` del grid de cabecera; por eso
  `.brand__img` lleva `max-width:none` y `.brand` `flex:none`.
- Navegación de escritorio: el menú completo (9 enlaces) solo se muestra a partir de
  `min-width:1240px` (antes 900px, que desbordaba la cabecera). Por debajo se usa la
  hamburguesa. `.site-header__inner` se ensancha a 1280px (1320px en ≥1420px) para
  dar cabida al menú.
- Fondo animado: `.bg-fx` (capa fija detrás del contenido, `aria-hidden`). `html`
  lleva el color base y `body` es transparente. `.section--alt` usa un gris
  semitransparente (`rgba(244,247,252,.72)`) para que el movimiento se vea a través.
  Se desactiva con `prefers-reduced-motion`.
- Modo plantilla (sin sesión): los formularios `[data-requires-login]` NO se ocultan;
  `aplicarEstadoAuth()` les añade `.is-locked` (atenuado, campos deshabilitados y
  `aria-disabled`). El aviso `[data-login-prompt]` solo se oculta si hay sesión.
  NO volver a poner `hidden` en esos formularios.
- Botón "Continuar con Google" (`[data-google-start]`): sin credenciales
  (`data-google-off`) muestra de inmediato el aviso `#googleNotice` en la propia
  pantalla en lugar de recargar. El JS vive en `admin/assets/admin-auth.js`.
- SEO: JSON-LD con tres bloques (LocalBusiness, WebSite, FAQPage). Al cambiar las
  FAQ de la sección `#faq`, actualizar también el FAQPage. `robots.txt` y
  `sitemap.xml` usan el marcador `[DOMINIO]`.
- Portada sin JS: servicios, proceso y testimonios tienen contenido estático de
  respaldo en index.html dentro de `[data-content-list]`, que la API puede reemplazar.

## Rediseño (referencia tipo agencia de IA)

- Paleta en `:root` (css/styles.css): `--color-primary` azul eléctrico `#0A68D9`,
  `--color-navy` `#0A1F3C` para fondos oscuros, `--color-accent` turquesa y
  `--color-amber` ámbar de apoyo. Cambiar estos 4 valores recolorea el sitio.
- Tipografía: titulares `Space Grotesk` (`--font-head`), cuerpo `Inter`
  (`--font-body`). Ambas son VARIABLES y van 100% autoalojadas en
  `assets/fonts/*.woff2` (subconjuntos latin y latin-ext) con `@font-face` en
  css/styles.css y admin/assets/admin.css y `preload` en el head. NO se usa
  Google Fonts ni ningún CDN externo. Licencia OFL (uso comercial libre). Ver
  `assets/fonts/LEEME.txt`.
- Hero oscuro (`.hero`): fondo navy con retícula (`::before`), halo animado
  (`::after`, keyframe `hero-glow`), badge con punto pulsante (`.hero__badge`),
  titular con degradado animado (`.hero__title .text-accent`) y botón
  `.btn--outline-light` para fondos oscuros. Entrada escalonada de sus hijos
  (`.hero__content > *`) con `hero-in` cuando `html.has-reveal-anim`.
- Banner marquesina (`.trustbar` + `.marquee`): franja navy tras el hero con
  textos de tecnologías. La lista `.marquee__track` está duplicada (la 2ª copia
  con `aria-hidden="true"`) para el bucle sin cortes; pausa al pasar el ratón.
- Cabecera glass (`.site-header`, `backdrop-filter`); al bajar gana sombra con la
  clase `.is-scrolled` que añade `setupHeaderScroll()` en js/main.js.
- Nav de escritorio tipo pill (`.nav-link` con `border-radius: pill` y fondo suave
  en activo/hover), en vez del subrayado anterior.
- Tarjetas de servicio (`.card`): borde superior con degradado al hover y realce
  del icono. Pasos (`.step`): número grande de marca de agua vía `attr(data-step)`
  (cada `<li class="step">` lleva `data-step="01".."04"`).
- Todo lo animado se desactiva en `@media (prefers-reduced-motion: reduce)`.
- Resto de secciones con el mismo lenguaje: testimonios (comilla gigante de
  fondo, barra superior degradada, avatar con degradado, controles con sombra),
  proyectos (zoom de imagen al hover, flecha animada en el enlace), tarjetas
  misión/visión, valores, acordeón (borde azul al abrir vía `:has()`), reseñas y
  botón "volver arriba". El pie de página usa el mismo navy del hero con retícula
  y halo azul (`radial-gradient`) y redes sociales en cajas redondeadas.
- Orden de secciones: Hero → Sobre nosotros → Servicios → Proyectos → Cómo
  trabajamos → Testimonios → Opiniones (Google) → Contacto → FAQ (última) → pie.
- Alternancia de fondos: `.section--alt` en Servicios, Cómo trabajamos,
  Opiniones y FAQ (la última); Sobre nosotros, Proyectos, Testimonios y
  Contacto quedan en blanco. El menú y los enlaces del pie siguen este orden.
- Testimonios con FOTO: el avatar admite `<img class="testimonial__avatar">`
  (foto circular, `object-fit:cover`) o las iniciales en un `<span>` como
  respaldo. Fotos en `assets/img/testimonios/*.jpg` (200x200, ~6-10 KB).
  En la BD el testimonio lleva `meta.photo` con la ruta; en los testimonios de
  usuarios se usa `users.avatar_url` (p. ej. foto de Google) si existe.
  Para cambiar una foto: reemplaza el .jpg o edita `meta.photo` en `content_items`.

## Aportaciones abiertas (sin registro)
- Los formularios de la web pública (contacto, testimonio, valoración y
  pregunta) están abiertos a cualquier visitante: NO requieren cuenta.
- Backend: `api/contact.php`, `api/reviews.php` y `api/submissions.php` usan
  `current_user()` (no `require_user()`); si hay sesión asocian `user_id`, si no
  guardan `user_id = 0` (anónimo). `csrf_require()` sí se mantiene.
- `js/main.js`: `setupAuthGate()` solo carga contenido; no bloquea formularios.
  La cabecera cambia el enlace "Acceder"/"Mi cuenta" según `?resource=session`.
- Si los módulos devuelven "desactivadas", revisar la tabla `settings`
  (`reviews_enabled`, `submissions_enabled`) en `app/data/c-rotulus.sqlite`.

## Paleta del logo
- Paleta anclada al logo (azul + gris). Valores en `:root` de `css/styles.css`:
  `--color-primary:#0050A0`, `--color-accent:#1E6FBF`, `--color-amber:#8FB4DE`
  (apoyo azul claro), `--color-navy:#062A52`, `--color-heading:#6B6B6B`.
- No hay turquesa ni ámbar: todos los acentos derivan del azul del logo.
- El logo va en la cabecera (`.site-header .brand__img`) y en el pie.

## Homogeneización de marca (web + panel)
- FUENTES: titulares "Space Grotesk" (--font-head) y cuerpo "Inter" (--font-body)
  en TODAS las páginas. Ambas autoalojadas (assets/fonts/*.woff2 + @font-face en
  css/styles.css y admin/assets/admin.css). No hay Google Fonts ni CDN externos.
  Cambiar una familia = tocar css/styles.css y admin/assets/admin.css a la par.
- IMÁGENES: los originales PNG/JPG se conservan como respaldo, pero el sitio
  sirve variantes WebP y AVIF mediante <picture> (logos y avatares) y usa
  `loading="lazy"`, `width`/`height` y `decoding="async"`. Regenerar con Pillow
  (webp+avif) cuando se sustituyan las fotos. Open Graph = og-image.jpg.
- SEO: canonical/OG con marcador [DOMINIO]; JSON-LD AutoRepair + WebSite +
  FAQPage (sincronizar con #faq); favicon.svg + apple-touch-icon.png; sitemap.xml
  y robots.txt. Sin scripts externos: no hay Google Analytics (se retiró).
- PALETA (identica en css/styles.css y admin/assets/admin.css):
  --color-primary #0050A0, --color-accent #1E6FBF, --color-amber #8FB4DE
  (apoyo), --color-navy #062A52, --color-heading #0A2C57 (azul profundo en
  titulares), --color-heading-gray #6B6B6B (gris del logo en textos secundarios).
  No hay turquesa/ámbar: todo deriva del logo. Al cambiar una, cambiar la otra.
- NAVBAR DEL PANEL: admin/bootstrap.php pinta el logo real
  (.brand__logo -> assets/img/logo-header.png) en `.brand`; se retiro el
  pseudo-elemento `.brand::before`. El navbar publico ya usaba `.brand__img`.
- Titulos de seccion con regla de acento degradada via
  `.section__head .section__title::after`.
- Cache: APP_ASSET_VERSION en app/bootstrap.php; el HTML publico usa ?v=...
  (version actual 20261014e).

## Secciones azules con puntos "estrellas" y microanimaciones (2026-10-14)
- Las secciones alternas (.section--alt: #servicios, #proceso, #valoraciones, #faq) llevan fondo azul degradado tipo login (linear-gradient 155deg primary -> primary-dark -> navy). La cabecera de seccion se fuerza a blanco; las tarjetas blancas conservan su texto oscuro (.section--alt .card { color: var(--color-ink) }).
- La textura decorativa son los puntos "estrellas" de la capa ::before de cada superficie azul (4 tramas de radial-gradient en .section--alt/--blue::before, .hero::before y .site-footer::before). Se animan con `@keyframes stars-drift` (deriva -2.5% y centelleo de opacidad .35 -> .7 en 22-34s segun la superficie). Es lo que da "vida" al azul; NO hay bolas grandes.
- Se eliminaron las "bolas" grandes (.section-orbs > .orb) y su funcion setupSectionOrbs() en js/main.js: eran 25 nodos con filter blur animado (coste alto). En el panel de acceso las bolas tambien se quitaron; .auth-aside::before lleva ahora el mismo `stars-drift` (definido en admin/assets/admin.css).
- Pausa de animaciones fuera de pantalla: setupOffscreenPause() en js/main.js pone la clase .is-offscreen (IntersectionObserver) en .hero/.section--alt/.section--blue/.site-footer/.bg-fx; el CSS pausa su ::before/::after. Verificado: running en viewport, paused fuera.
- Microanimaciones: barrido de brillo en .btn--primary::after y glow section-glow. Todo se desactiva con prefers-reduced-motion.
- Rendimiento (2026-10-14): eliminados los filter blur(24/30/60px) de capas decorativas (los degradados radiales ya son suaves), backdrop-filter de la cabecera bajado a blur(6px), retícula de fondo .bg-fx__grid sin animacion (se quito bg-pan), contain: layout paint en .section--alt/--blue.
- El fondo azul con estrellas se aplica a .section--alt, .hero y .site-footer. La seccion de presentacion (#sobre-nosotros) vuelve a fondo blanco. .section--blue queda como modificador reutilizable (sin uso actual).
- El PIE DE PAGINA lleva un azul PROFUNDO distinto (navy del logo: linear-gradient(160deg, navy -> #04203F)) con franja de acento superior (border-top 4px accent) con los puntos "estrellas" blancos/azul claro en .site-footer::before (opacity .55) y textos claros: enlaces #C7D9F0, titulos y hover en blanco; iconos sociales en placa translucida que se vuelve blanca con icono azul al hover; separadores rgba(255,255,255,.18).
- Cache: version actual 20261016l (APP_ASSET_VERSION).

## Reseñas de Google en vivo con caché en BD (2026-10-13)
- `app/lib/google_reviews.php` (cargado desde `app/bootstrap.php`): lee la ficha
  de Google vía Google Places API y guarda el resultado en la tabla
  `google_reviews` + resumen en `settings`.
- Endpoint público: `api/index.php?resource=google_reviews` (admite `&force=1`).
  Respuesta: `{enabled, live, cached, stale, summary:{average,total,stars}, items}`.
- Comportamiento: con conexión -> `live=true` (actualiza); sin conexión ->
  `stale=true` y devuelve las últimas 3 guardadas; si no hay credenciales pero
  hay caché -> `enabled=false, cached=true`. El frontend (`cargarGoogleReviews()`
  en `js/main.js`) pinta las reseñas si `items` no está vacío y muestra un aviso
  `[data-gr-status]` cuando `stale`. Reintenta con el evento `online`.
- Ajustes (panel · Ajustes · Reseñas): `google_place_id`, `google_places_api_key`
  (secreto, enmascarado), `google_reviews_url`, `google_reviews_cache_ttl`.
  Botón «Actualizar reseñas de Google ahora» -> acción `refresh_google_reviews`.
- Marcadores en `index.html`: `data-gr-score`, `data-gr-stars`, `data-gr-count`,
  `data-gr-list`, `data-gr-status`. Si no hay datos, se conservan las 3 reseñas
  de ejemplo del HTML (editables a mano).
- La caché local sembrada (data/c-rotulus.sqlite) contiene las 3 reseñas de
  ejemplo para que el preview muestre la sección dinámica.

## Correo: bug de "enviado pero no llega" resuelto (2026-10-13)
- Causa raíz: `smtp_send()` no comprobaba las respuestas de `MAIL FROM`,
  `RCPT TO` ni `DATA`; solo miraba la última. Un rechazo real del servidor
  (p. ej. Gmail `550`/`553` o `535`) pasaba por éxito y el formulario decía
  «enviado» aunque el correo nunca salía.
- `app/lib/mailer.php`: `smtp_send()` ahora valida el código de cada comando,
  guarda el motivo exacto en `mailer_last_error()` y devuelve `false` si algo
  falla. Nuevos helpers: `mailer_from_email()` (usa `smtp_user` si `from_email`
  está vacío, obligatorio en Gmail), `mail_notify_to()` y soporte de `Reply-To`.
- Nuevo ajuste `mail_to_email` (destino de los avisos; si está vacío usa el
  correo de contacto). Añadido a `config.php`, `settings_editable()`,
  `settings_config_map()` y al panel (Ajustes · Correo, con ayuda Gmail).
- Envíos actualizados para usar `mail_notify_to()`: `api/contact.php`
  (con `Reply-To` del cliente), `api/submissions.php`, `api/reviews.php`,
  `admin/account.php`. El test del panel ahora muestra el error real.
- Destino configurado a `crotulus.mipyme@gmail.com`. Admin de pruebas: usuario
  #2 con ese correo y contraseña `Crotulus-2026` (SQLite local).
- Pendiente del propietario: pegar la contraseña de aplicación de Gmail y poner
  `mail_transport` en `smtp` (panel · Ajustes · Correo) y pulsar la prueba.

## Reseñas de Trustpilot (2026-10-13)
- Nueva sección pública `#trustpilot` (reseñas verificadas), en espejo de la de
  Google. Marcadores en `index.html`: `data-tp-score`, `data-tp-stars`,
  `data-tp-count`, `data-tp-list`, `data-tp-status`, `data-trustpilot-link`.
- `js/main.js`: `cargarTrustpilot()` / `pintarTrustpilot()` leen
  `?resource=trustpilot`; `setupTrustpilotLink()` toma la URL de la ficha desde
  `CONTACTO.trustpilot` (Ajustes · Reseñas). Si no hay datos, se conservan las 3
  reseñas de ejemplo del HTML.
- `app/lib/reviews.php`: `trustpilot_domain()` ignora la URL de ejemplo entre
  corchetes (`[URL_TRUSTPILOT]`), igual que se hace con la de Google.

## Aportaciones solo con cuenta (2026-10-13)
- Se eliminaron los formularios públicos de testimonio y de pregunta de la
  landing. Ahora viven en el área privada `admin/account.php` (enlace «Mi cuenta»
  en la cabecera), accesible tras iniciar sesión.
- `api/submissions.php` exige sesión (`require_login`); el aviso por correo usa
  el nombre del usuario logueado.
- `api/index.php?resource=session` devuelve el rol (`user`/`admin`).
- `admin/login.php` redirige por rol: admin -> panel; resto -> `account.php`.
- La landing deja un CTA «Inicia sesión…» en Testimonios y FAQ.
- Versión de assets: `20261016f`.

## Footer claro y logo azul (2026-10-13)
- `.site-footer` usa fondo claro (`--color-bg-alt`) con borde superior de marca;
  se eliminó el degradado azul. El logo del pie es la versión solo azul
  (`assets/img/logo-footer-blue.{png,webp,avif}`).
- `setupSectionOrbs()` en `js/main.js` ya NO incluye el pie (no es azul).
- Cache actual: `20261016d` (index.html + APP_ASSET_VERSION en bootstrap.php).

## Arrancar el servidor de pruebas (preview)
- El contenedor NO trae PHP de serie y se reinicia a menudo: si la preview da
  HTTP 502, es que no hay servidor. Reinstalar y arrancar:
  `sudo apt-get update && sudo apt-get install -y php-cli php-sqlite3 php-mbstring php-curl`
  y luego `cd /workspace/project/prueba && nohup php -S 0.0.0.0:12000 -t . > /tmp/php_server.log 2>&1 &`
- Puerto 12000 = https://work-1-hhbxisjnziknathi.prod-runtime.all-hands.dev/
- El ZIP descargable (`c-rotulus-sitio.zip`) vive en la raíz del proyecto y se
  sirve desde el mismo servidor; regenerarlo tras cambios importantes.
- Comprobar: `/api/index.php?resource=health` debe dar `{"ok":true,"driver":"sqlite"}`.

## Datos de empresa: privacidad
- El cliente es una mipyme real (C-ROTULUS S.U.R.L., Artemisa, Cuba). Los datos
  de contacto se dejaron como MARCADORES (`[TELÉFONO]`, `[CORREO]`,
  `[DIRECCIÓN]`, `[CIUDAD]`, `[URL_FACEBOOK]`) por privacidad; se rellenan desde
  el panel (Ajustes · Contacto) sin tocar el HTML. No hardcodear datos
  personales reales sin consentimiento explícito.

## Paleta del cliente + tipografia Plus Jakarta Sans (2026-10-14)
- Paleta oficial del cliente aplicada a TODAS las paginas (web + panel): azul petroleo #136493 (primario), azul hielo #C5E2F2 (fondos suaves y texto claro sobre azul) y gris #BDBDBD (bordes/placa neutra). Variables en :root de css/styles.css y admin/assets/admin.css: --color-primary #136493, --color-primary-dark #0E4E75, --color-primary-soft #E7F1F8, --color-navy #0B2E45, --color-accent #2E86B8, --color-accent-soft #5FA8C9, --color-ice #C5E2F2, --color-steel #BDBDBD. Los azules/grises fijos de CSS, SVG, mailer, verify.php y theme-color se migraron a esta paleta.
- Tipografia: se sustituyo Space Grotesk por Plus Jakarta Sans (variable 400-800) en titulares; el texto sigue en Inter. Fuentes autoalojadas en assets/fonts (PlusJakartaSans-latin.woff2 y -latin-ext.woff2). @font-face y preloads actualizados en css/styles.css, admin/assets/admin.css, index.html y admin/bootstrap.php.
- El pie de pagina ya NO anima sus puntos: .site-footer::before es estatico (se quito del grupo stars-drift). Fondo navy profundo (linear-gradient(160deg, #0B2E45 -> #082738)) con franja de acento superior.

## Logo del pie, imagenes con personas y captcha (2026-10-16)
- El logo del pie ahora usa la MISMA version que cabecera y acceso: `logo-header.{avif,webp,png}` (azul + "ROTULUS" gris) sobre `.logo-plate` blanca (padding .6/.75, radius 12, sombra suave, hover elevado). Tamano 170px. Se descarto la silueta monocroma `logo-footer-blue`.
- Se ELIMINO por completo la textura de puntos del pie (`.site-footer::before` ya no existe) y su entrada en el grupo de pausa/reduced-motion. El pie queda como banda limpia de cierre.
- Ilustraciones rehechas con figuras humanas (estilo plano, paleta de marca) e incluyen microanimaciones SVG propias (`bob`, `pulse`, `wave`) con `prefers-reduced-motion`:
  - `assets/img/hero-tech.svg` (equipo trabajando + pantalla con nube/datos),
  - `assets/img/equipo.svg` (3 personas + portatil),
  - `assets/img/proyecto-web.svg`, `proyecto-ia.svg` (agente con auriculares), `proyecto-redes.svg` (rack + tecnico).
  - Generadas con script temporal (patron `person()`); el pelo es un arco superior (`a22 22 0 0 1 44 0`).
- Homepage con mas vida: flotado continuo de la ilustracion del hero (`float-soft`), indicador de scroll `.hero__scroll` con rebote, y sombra profunda al pasar el raton. La entrada escalonada del hero ya existia.
- Captcha propio accesible (sin dependencias): `app/lib/captcha.php` (reto aritmetico firmado con HMAC + caducidad 20 min, config `security.captcha_ttl`). Cargado en `app/bootstrap.php`. API: `GET api/index.php?action=captcha`. Verificado en `api/contact.php` antes de la validacion (responde 422 con `fields.captcha`). El JS (`cargarCaptcha()`) pinta el reto, boton de renovar y lo refresca tras cada envio. El campo trampa `_gotcha` sigue activo dentro del bloque del captcha.
- Corregida la clave de validacion JS del telefono: era `teléfono` (con tilde) y no coincidia con el `name="telefono"`; ahora si valida.
- Cache actual: `20261016m`. ZIP regenerado (96 archivos).

## Navbar rediseñado, mapa funcional y datos reales (2026-10-16)
- Nueva **barra superior** (`.topbar`) sobre la cabecera, visible a partir de 1100 px: teléfonos, correo, horario y redes sociales. Se oculta en móvil/tableta.
- **Menú principal** rediseñado: enlaces como pastillas (`.nav-link` con `border-radius` pill), punto-guía de marca a la izquierda en móvil, CTA «Contacto» como botón propio (`.btn--nav-cta`) y logo con plato blanco. En horizontal a partir de 1240 px (antes 1400) con menos etiquetas («Nosotros», «Proceso») para que quepan las 9 secciones.
- Se eliminó `.nav-link--cta` (el CTA ahora es `.btn--nav-cta`); el estado activo usa fondo `--color-primary-soft`.
- **Mapa funcional**: `#contactMap` ahora incrusta un `<iframe>` de Google Maps (`...&output=embed`), con `aspect-ratio` y botón «Cómo llegar» (`maps/dir/?api=1&destination=...`). Ya no se usa `assets/img/mapa.svg` en el HTML. `aplicarAjustes()` (main.js) sigue sustituyendo el iframe si hay `mapa_embed` en el panel.
- **Datos reales** aplicados en HTML, JSON-LD, `app/config.php` y BD (los ajustes guardados tienen prioridad):
  teléfono principal `+5359888821`, secundario `+5349368808`, WhatsApp `5359888821`,
  correo `crotulus.mipyme@gmail.com`, dirección `Calle 29 #5408 e/ 54 y 56` (Artemisa),
  horario `Lunes a Viernes de 9:00 am a 5:00 pm`.
- **Dos teléfonos**: los enlaces con `data-tel-secondary` conservan su propio número (main.js los excluye de la reescritura `tel:` desde la API); el resto usa `data-tel-primary` / `data-site="telefono"`.
- JSON-LD `ProfessionalService` (antes `AutoRepair`) con dirección CU, `areaServed: Cuba` y cierre a las 17:00.
- Cache actual: `20261016n`.

## Pie con fondo gris sólido de la paleta (2026-10-16)
- `.site-footer` pasa del degradado navy al **gris sólido de la paleta** (`--color-steel` = `#BDBDBD`), con franja superior `--color-primary`. Ya no hay degradado ni capa de puntos.
- Ajuste final: el gris se **oscureció a `--color-steel-dark` = `#3F4A52`** (gris con matiz azulado) para que combine con el azul petroleo y dé más presencia al cierre. Al ser oscuro, el texto vuelve a tonos claros (`--color-ice`) para mantener contraste AA: títulos de columna en `#fff`, enlaces en azul hielo con hover blanco, separador `rgba(255,255,255,.18)`.
- Botones sociales del pie: fondo `rgba(255,255,255,.10)` con icono blanco; al pasar el ratón, fondo azul de marca. El logo sigue sobre `.logo-plate` blanca.
- Cache actual: `20261016p`.

## Reducción de componentes (2026-10-16)
Pasada de escala para aligerar el sitio: se reducen botones, ritmo de secciones, hero, cifras, tarjetas (servicio, equipo, blog, proyecto, paso), testimonios, acordeón, formulario de contacto, datos de contacto/mapa y pie. El texto base del cuerpo NO se toca (legibilidad). Valores clave:
- `.btn`: `1.12rem` → `1rem`, padding `.8rem 1.4rem` → `.7rem 1.2rem`.
- `.section`: `4rem` → `3.25rem` (y `5.5rem` → `4.5rem` en ≥900px); `.section__head` margen `2.5rem` → `2rem`; `.section__title` clamp máx. `2.4rem` → `2.1rem`; `.eyebrow` `.95rem` → `.82rem`.
- Hero: padding `3.25/3.75rem` → `2.75/3.25rem` (y `4.5/5rem` → `3.75/4.25rem`); `.hero__title` clamp máx. `3.6rem` → `3.1rem`; subtítulo `1.1rem` → `1.02rem`.
- Cifras: `.stat__num` `1.9rem` → `1.7rem`.
- Tarjetas: padding `1.5rem` → `1.25rem`; `.card__icon` `54px` → `48px`; `.step` padding y `.step__num` `48px` → `42px`; watermark `5.6rem` → `4.6rem`; títulos ~`1.15rem` → ~`1.06rem`.
- **Formulario de contacto**: `.contact-form` padding `1.5rem` → `1.2rem`; `.field` margen `1rem` → `.8rem`; label `.92rem` → `.88rem`; inputs padding `.75rem .85rem` → `.62rem .75rem`; textarea `120px` → `100px`; `.field__error` `.82rem` → `.78rem`.
- Acordeón: gap `.75rem` → `.65rem`; trigger padding `1.05/1.2rem` → `.9/1.05rem`, fuente `1rem` → `.95rem`.
- Testimonios: padding `2rem 1.6rem` → `1.6rem 1.35rem`; cita `1.05rem` → `.98rem`.
- Pie: padding `3.25rem` → `2.6rem`; títulos `1.12rem` → `1rem`; enlaces `.92rem` → `.89rem`; redes `42px` → `38px`.
- Cache actual: `20261016s`.

## Menú principal: fuente reducida (2026-10-16)
Con 11 secciones el menú quedaba justo. Se reduce el tamaño de los enlaces en escritorio (`.nav-link`: `.82rem` → `.76rem`, con `letter-spacing: .02em` y padding `.5rem .68rem` → `.45rem .55rem`), el enlace «Acceder» (`.84rem` → `.78rem`) y el menú móvil (`.84rem` → `.8rem`). El punto de corte del menú horizontal baja de `1240px` a `1160px`: el contenedor de la cabecera está limitado a `1140px`, así que a partir de `1160px` el ancho útil es idéntico al de `1240px` y no hay riesgo de desbordamiento. En pantallas ≥1560px el menú usa `.82rem`.

## Sección «Sobre nosotros»: historia + misión + visión en un párrafo (2026-10-16)
A petición del cliente, se unifican los tres bloques («Nuestra historia», tarjetas de «Misión» y «Visión») en un **único párrafo** dentro de `.about__body` (`index.html`), bajo el subtítulo «Quiénes somos». Se elimina el bloque `.mv-grid`/`.mv-card` de esa sección. Las clases `.mv-*` se conservan en `css/styles.css` porque pueden reutilizarse. Este texto es HTML estático (no lo gestiona la API ni el panel).

## Secciones nuevas: Blog y Equipo (2026-10-16)
Se añaden dos secciones al sitio con gestión completa desde el panel, siguiendo el patrón del contenido editable (tabla propia + API + render en JS + fallback al HTML).
- **BD** (`app/lib/db.php`, `app/schema.sql`): tablas `blog_posts` (slug, title, excerpt, body, category, author, image, meta JSON, sort_order, is_active, published_at) y `team_members` (name, role, bio, email, phone, avatar, meta JSON, sort_order, is_active). Índices `idx_blog_active`, `idx_team_active`. Migración automática (CREATE TABLE IF NOT EXISTS) + `db_table_exists()` + `seed_blog_and_team()` (3 artículos y 4 miembros de ejemplo, solo si la tabla está vacía).
- **Libs**: `app/lib/blog.php` (`blog_posts()`, `blog_post_by_id()`, `blog_post_public()`) y `app/lib/team.php` (`team_members()`, `team_member_by_id()`, `team_member_public()`). Cargadas en `app/bootstrap.php`.
- **API** (`api/index.php`): recursos `?resource=blog` (con `&limit=` y `&slug=` para un artículo con cuerpo completo) y `?resource=team`.
- **Panel**: `admin/blog.php` (alta/edición, slug autogenerado con `slugify()`, publicar/ocultar, borrar) y `admin/team.php` (alta/edición, mostrar/ocultar, borrar). Enlaces «Blog» y «Equipo» añadidos al menú del panel (`admin/bootstrap.php`).
- **Frontend** (`index.html`, `css/styles.css`, `js/main.js`): secciones `#equipo` (tras Sobre nosotros, fondo `--soft`) y `#blog` (tras Proyectos, fondo blanco); estilos `.team`/`.team-card` y `.blog`/`.post`; `loadBlog()`/`loadTeam()` + `itemPost()`/`itemMiembro()` con fallback al HTML de ejemplo. Enlaces añadidos al menú principal y al pie.
- **Imágenes**: `assets/img/equipo/*.svg` (4 avatares) y `assets/img/blog/*.svg` (3 portadas), estilo SVG plano de marca, fáciles de reemplazar por fotos.
- **Nota**: la sección Blog muestra tarjetas (portada + extracto + autor + fecha + minutos); al pulsar, enlazan a `#blog` (mismo comportamiento que los proyectos de ejemplo). El campo `body` ya está disponible vía API (`&slug=`) para futuras páginas de detalle.
- Cache actual: `20261016t`.

## Textos editables desde la BD: portada, cifras, secciones y pie (2026-10-16)
Se completa la persistencia en base de datos del contenido que seguía fijo en el HTML. Antes solo se editaban desde el panel los datos de contacto, redes, reseñas, blog y equipo; ahora también los textos de la web.
- **Config** (`app/config.php`, bloque `defaults`): nuevas claves con valor por defecto: `hero_badge`, `hero_title`, `hero_title_accent`, `hero_subtitle`, `hero_cta1_label`, `hero_cta2_label`, `hero_image`, `hero_image_alt`, `stat1..4_value`, `stat1..4_label`, `about_title/lead/body/image/image_alt`, cabeceras `<seccion>_eyebrow/_title/_lead` (team, services, projects, blog, process, testimonials, reviews, trustpilot, contact, location, faq), `footer_tagline` y `footer_legal`.
- **Listas blancas** (`app/lib/settings.php`): todas las claves anteriores añadidas a `settings_editable()` y `settings_public()` (esta última es la que ve la web). No se exponen claves sensibles.
- **Panel** (`admin/settings.php`): nueva pestaña **Textos** con formularios para portada, cifras, «Sobre nosotros», cabeceras de sección y pie. Las imágenes se sanean con `sanitize_image_path()` (ruta relativa `assets/...` o URL `http(s)`, sin `..`); las cifras son numéricas. CSS de `fieldset`/`.field-group` en `admin/assets/admin.css`.
- **Frontend** (`index.html`, `js/main.js`): atributos `data-site` (textos), `data-site-title`/`data-site-accent` (titular del hero con palabra destacada), `data-site-stat` (cifra + etiqueta), `data-site-image`/`data-site-alt` (imágenes) y `data-footer-legal`. `aplicarAjustes()` los aplica al cargar; si la API no responde, el HTML de ejemplo se mantiene.
- **Contadores**: la animación de `.stat__num` se extrae a `animarStat()`, reutilizada al aplicar el valor de la BD (antes el valor guardado se sobrescribía con el de la animación).
- **Verificado** de extremo a extremo por HTTP: login → POST en `admin/settings.php` → fila en `settings` → `api/index.php?resource=settings` → render en el navegador. Los datos de prueba se eliminaron y la contraseña del admin quedó restaurada.
- Cache actual: `20261016t`.

## Botones de WhatsApp con enlace directo (2026-10-16)
Los dos botones de WhatsApp (el del hero `.btn--outline-light` y la cita flotante `.float-wa`) llevan ahora el `href` **ya escrito** a `https://wa.me/5359888821?text=...` en `index.html`, en vez de `href="#contacto"`. Así funcionan aunque JavaScript no cargue. `setupWhatsAppLinks()` en `js/main.js` sigue regenerando el enlace con el número de la BD (clave `whatsapp`, hoy `5359888821`) y el mensaje `WHATSAPP_MSG`, por lo que editar el número en el panel sigue teniendo efecto. Cache actual: `20261016u`.

## Boton flotante: widget de chat en vez de WhatsApp (2026-10-19)
La cita flotante verde de WhatsApp (`.float-wa`) esta **sustituida** por el widget de
chat de CreatuAgente (`<script src="https://api.creatuagente.io/widget/cmv8ia68j0f3j0bs6190merf8/widget-profile.js" async>`),
añadido antes de `</body>` en `index.html` y `empresa.html`. El widget inyecta su
**propio** boton flotante (60x60, abajo a la derecha, `z-index` maximo), de modo que
mantener los dos duplicaba botones. El `<a class="float-wa">` queda comentado en el
HTML por si se quiere recuperar; para volver a WhatsApp: descomentar el enlace y
borrar la linea del script.
- El CSS `.float-wa` y la variable `--color-wa` se conservan (inofensivos) por si se reactiva.
- `.back-top` sube a `bottom: 7.2rem` para no solaparse con el boton del widget.
- El enlace de WhatsApp del **hero** no se toca (sigue con `data-whatsapp-link`).
- No hay CSP en el HTML ni en `.htaccess`, asi que el script externo carga sin bloqueo.

## Servidor de vista previa que se apaga (2026-10-19, ampliado)
Sintoma: "abro la pagina desde otra maquina y no carga / el servidor PHP se apaga".
Causa real: el sandbox de vista previa se **recrea entre sesiones**. Solo persiste
`/workspace` (volumen ext4); `/usr` (PHP), `/home` (`.bashrc`), `/etc` y `/tmp` se
reconstruyen desde el overlay. No hay cron, systemd usable, supervisor ni rc.local,
y el agent-server no expone hook de arranque. El sitio en si es correcto (accesible
desde fuera cuando el servidor esta vivo; verificado con fetch externo y navegador).
Comprobado ademas: sin CSP, sin contenido mixto, sin `localhost`/rutas absolutas.

Solucion en capas (todas dentro de `/workspace`, que persiste):
1. **PHP portatil autonomo** en `/workspace/.php-runtime` (binario + `ext/` + `lib/`
   con libsodium/libargon2 + `etc/php.ini`). Sobrevive al reinicio: no depende de `apt`.
2. **`tools/serve.sh`** con resolucion de PHP en cascada: portatil -> sistema -> apt
   (y al instalar por apt, se empaqueta el portatil para no repetir). Idempotente
   (`server_alive` busca `-S 0.0.0.0:12000`), arranca con `setsid` para sobrevivir al
   cierre del terminal. Modos: normal, `--ensure` (silencioso), `--watch` (vigila 15 s).
3. **Auto-arranque por conversacion**: `AGENTS.md` (persistente y autoloaded) instruye
   ejecutar `bash tools/serve.sh --ensure` al inicio de cada sesion.
4. Para regenerar el PHP portatil desde cero: borrar `/workspace/.php-runtime` y
   ejecutar `bash tools/serve.sh` (instala por apt y vuelve a empaquetar).

- `tools/` esta excluido del ZIP de despliegue: no llega al hosting real.
- En produccion esto NO ocurre: el hosting mantiene PHP siempre activo.
- El puerto 12001 (work-2) da 502 porque solo hay servidor en el 12000; usar work-1.

## Ritmo de fondos de secciones (2026-10-20)
Las secciones alternan **blanco liso -> azul con "bolas" animadas -> gris suave**
para que el diseno quede combinado (antes el fondo animado global `.bg-fx` se
transparentaba por las secciones claras).
- `.section` (base) = **blanco puro** (antes era transparente).
- `.section--blue` / `.section--alt` = **azul + bolas en movimiento**. El
  degradado de las secciones azules es un paso MAS CLARO que el del hero
  (`#1A6E9C -> --color-primary -> --color-primary-dark`) para dar jerarquia.
- `.section--soft` = gris muy suave (`--color-bg-alt`).
- Orden en `index.html`: servicios blanco, proyectos azul, blog blanco, proceso
  azul, testimonios gris, opiniones azul, trustpilot gris, contacto azul,
  ubicacion gris, faq azul. (Nunca hay dos azules contiguos.)
- Sobre azul, `.project`, `.post`, `.testimonial__quote`, `.contact-form`,
  `.contact-info__item`, `.step`, `.accordion__item`, `.review-card` y
  `.google-reviews__summary` reciben fondo/acento claro (listas
  `.section--blue ...` y `.section--alt ...`).
- `.eyebrow` sobre azul = chip translucido claro (`rgba(255,255,255,.14)`), igual
  que el distintivo del hero.
- **Boton `--primary` sobre azul** (hero, secciones azules, pie) se pinta en
  BLANCO con texto azul: el degradado azul del boton se fundia con el fondo.
- `empresa.html`: "sobre-nosotros" blanco, "equipo" gris, CTA `.section--blue`.

## Ilustraciones SVG de la portada (2026-10-21)
Se rediseñaron las 7 imagenes SVG para que sean mas atractivas manteniendo la
tematica (tecnologia, marca azul), con: degradados, sombras (`feDropShadow`),
tarjetas flotantes, trazas de circuito y nodos con animacion.
- `assets/img/hero-tech.svg` -> panel de control (graficas + nube + seguridad + IA).
- `assets/img/proyecto-{web,ia,redes}.svg` -> tienda online, asistente IA, rack de red.
- `assets/img/blog/{automatizacion-ia-pymes,seguridad-red-pyme,web-que-convierte}.svg`.
- Mismos nombres de archivo: se pueden sustituir por fotos reales sin tocar el HTML.
- `index.html` referencia las imagenes con `?v=20261021` (cache-busting); al
  cambiar una imagen, sube ese numero.
- Filtros SVG definidos a nivel de `defs` (no sueltos) para que el render sea estable.
- Estilo interno de cada SVG: clases `.f/.f2/.f3` (flotar), `.pulse` (parpadeo),
  `.trace` (trazas animadas); respetan `prefers-reduced-motion`.

## Arreglos puntuales (2026-10-20)
- **Facebook**: `[URL_FACEBOOK]` sustituido por la pagina real
  `https://www.facebook.com/com.rotulus.surl` en `index.html`, `empresa.html`
  (href + JSON-LD sameAs) y `app/config.php` (settings `facebook`).
- **Mapa**: el iframe de Google Maps **ya funcionaba**; el `<html></html>` vacio
  que se veia al inspeccionar era el documento interno del iframe, no un error
  del sitio. No requiere cambios.

## Kit de despliegue (2026-10-16)
Preparado el sitio para publicarlo en cualquier hosting, de lo básico a lo avanzado:
- **`DEPLOY.md`**: guía por niveles (1. FTP manual, 2. cPanel/Plesk con MySQL+SMTP+SSL+cron, 3. VPS con SSH/rsync/Nginx/backups/CDN), comprobaciones y problemas frecuentes.
- **`app/preflight.php`**: diagnóstico previo (PHP, extensiones, permisos, `.htaccess`, conexión BD, tablas, usuarios, HTTPS, correo). Uso: `php app/preflight.php` o por web con `config.local.php → 'preflight_key'` (`/app/preflight.php?key=...`; sin clave responde 404). Sale con código ≠0 si hay fallos.
- **`deploy/config.local.example.php`**: plantilla de config de producción (cópiala a `app/config.local.php`).
- **`deploy/cron/backup.php`**: copia con fecha en `app/data/backups/`, soporta MySQL (volcado SQL con PDO) y SQLite (`VACUUM INTO`), rota las últimas 14.
- **`deploy/deploy.sh`**: sincronización por SSH/rsync sin sobrescribir `config.local.php` ni datos.
- **`deploy/nginx/nginx.conf.example`**: Nginx (bloquea `app/`, `deploy/`, `tools/`, `.sqlite`/`.log`, `config.local.php`; caché y gzip).
- **`.htaccess`** endurecido: `Options -Indexes`, `ErrorDocument`, bloqueo de `deploy/` y `tools/`, y redirecciones HTTPS/www/proxy (comentadas).
- Nueva clave de config `preflight_key` (vacía = diagnóstico web desactivado).
- `tools/build_zip.py` ahora excluye `*.zip`. ZIP: 108 archivos, sin `config.local.php`, BD, logs ni ZIP.


## Kit específico para Raiola Networks (2026-10-16)
Raiola = **cPanel + CloudLinux + LiteSpeed**, backups con **JetBackup**, y **sin SSH** en hosting compartido (sí en Elástico/VPS).
- **`DEPLOY-RAIOLA.md`**: guía paso a paso (subir, PHP por cPanel, MySQL, config.local, SMTP con `mail.tu-dominio.com`, 404, SSL/Cloudflare, cron, checklist y problemas típicos).
- **`deploy/raiola/.htaccess-raiola`**: `.htaccess` para LiteSpeed (ErrorDocument 404, caché, gzip, seguridad, bloqueo de `app/`/`deploy/`/`tools/` y de `.sqlite`/`.log`/`.md`/`.zip`/`config.local.php`, `/api/` y `/admin/` sin caché, redirecciones HTTPS con/sin Cloudflare comentadas). Ojo: la versión de PHP se elige en cPanel, **no** con `AddHandler` (rompe LiteSpeed).
- **`deploy/raiola/config.local.example.php`**: config de ejemplo con valores típicos de Raiola (MySQL `localhost`, prefijo de usuario, SMTP `mail.tu-dominio.com` 465/ssl).
- **`404.html`**: página de error con la marca (autónoma, sin depender del CSS/JS). `ErrorDocument 404 /404.html` activado en el `.htaccess` general y en el de Raiola.
- ZIP: 112 archivos.


## Página "Empresa" con menú propio (2026-10-17)
Se sacó el contenido corporativo de la portada a una página nueva:
- **`empresa.html`**: cabecera de página con migas de pan, secciones **Sobre nosotros** (historia, valores, misión y visión) y **Equipo**, más un bloque de llamada a la acción. Reutiliza la cabecera, el pie, los estilos y `js/main.js` de `index.html` (sitio 100% estático, rutas relativas).
- **Menú**: en `index.html` y `empresa.html` el enlace «Empresa» apunta a `empresa.html` (sin submenús). Se eliminaron «Nosotros» y «Equipo» de la barra y del pie.
- **`index.html`**: se quitaron las secciones `#sobre-nosotros` y `#equipo`; el indicador del hero ahora baja a `#servicios`. Comentarios de sección renumerados.
- **`js/main.js`**: `setupSmoothScroll()` ahora entiende `index.html#ancla` (navega a la portada y salta a la sección) y mantiene el scroll suave en las anclas de la misma página; `setupActiveLink()` ignora los enlaces a otras páginas.
- **`css/styles.css`**: bloque nuevo `.page-hero`, `.breadcrumb` y `.page-cta` (reutiliza tokens de marca).
- **`app/config.php`**: `about_body` recorta la misión/visión (ahora van en tarjetas aparte) y se actualizó el valor en la BD. Etiqueta del panel renombrada a «Nuestra historia».
- **`sitemap.xml`**: añadida `empresa.html`; JSON-LD `AboutPage` + `BreadcrumbList` en la página.
- Cache actual: `20261017a`. ZIP: 113 archivos.

