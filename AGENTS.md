# AGENTS.md — Notas del proyecto C-ROTULUS

Sitio corporativo estatico (HTML/CSS/JS vanilla) + panel PHP de administracion.
Servir en local con: `php -S localhost:8000 -t .`

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

- Logo de cabecera: `.brand__img` con altura variable (44px base, 52px en ≥900px).
  El `<img>` de index.html lleva `width="226" height="85"` para reservar espacio
  y evitar saltos de layout (CLS). El logo del pie es otra instancia más pequeña.
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

## Secciones azules con "bolas" y microanimaciones (2026-10-13)
- Las secciones alternas (.section--alt: #servicios, #proceso, #valoraciones, #faq) llevan fondo azul degradado tipo login (linear-gradient 155deg primary -> primary-dark -> navy). La cabecera de seccion se fuerza a blanco; las tarjetas blancas conservan su texto oscuro (.section--alt .card { color: var(--color-ink) }).
- Las "bolas" son capas .section-orbs > .orb que inserta setupSectionOrbs() en js/main.js (NO estan en el HTML). Colores/tamanos/posiciones se editan en el array orbs de esa funcion. La capa lleva parallax suave por scroll.
- Se elimino el banner marquesina (trustbar/marquee) bajo el hero.
- Microanimaciones: barrido de brillo en .btn--primary::after, orbs flotantes (@keyframes orb-float[-b|-c|-d]), glow section-glow y pulso del hero. Todo se desactiva con prefers-reduced-motion.
- Cache: version actual 20261015f.

- Fondo azul con bolas tambien en la seccion de presentacion (#sobre-nosotros, clase .section--blue) y en el pie (.site-footer). setupSectionOrbs() ahora selecciona .section--alt, .section--blue y .site-footer. Textos de "Sobre nosotros" en claro sobre azul; las tarjetas mv-card siguen blancas. Cache: 20261015h.
