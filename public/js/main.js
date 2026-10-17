/* ============================================================================
   C-ROTULUS S.U.R.L. - JavaScript principal (vanilla, sin librerias)
   ----------------------------------------------------------------------------
   CONTENIDO:
     0.  Datos editables (teléfono, correo, WhatsApp...) -> UN SOLO SITIO
     1.  Menú hamburguesa (móvil)
     2.  Scroll suave y enlace activo segun la sección visible
     3.  Animaciones de aparicion al hacer scroll (IntersectionObserver)
     4.  Contador animado de las cifras de confianza
     5.  Acordeón de preguntas frecuentes
     6.  Carrusel de testimonios
     7.  Botón "volver arriba"
     8.  Formulario: validación + envio al servicio externo
     9.  Enlaces de WhatsApp con mensaje prellenado
     10. Anio del copyright
   ========================================================================== */

(function () {
  "use strict";

  /* ==========================================================================
     0. DATOS EDITABLES  (CAMBIA AQUÍ TUS DATOS REALES)
     --------------------------------------------------------------------------
     Estos valores se usan en el JS. Los mismos datos aparecen como texto en
     index.html con marcadores [TELÉFONO], [CORREO], etc. Sustituyelos también.
     ========================================================================== */

  // >>> URL DEL PANEL / BACKEND PHP  (importante si publicas en Vercel) <<<
  // El panel de administración (admin/) y la API (api/) necesitan PHP y una
  // base de datos, que un hosting 100% estático como Vercel NO ofrece.
  //   - Si publicas en un hosting CON PHP (p. ej. Raiola): deja "" (rutas
  //     relativas, todo funciona dentro del mismo dominio).
  //   - Si publicas la web estática en Vercel pero mantienes el panel en otro
  //     hosting con PHP: pon aquí su URL completa, SIN barra final, por ejemplo
  //     var BACKEND_URL = "https://www.c-rotulus.com";
  //     Así los enlaces "Acceder"/"Mi cuenta" y las llamadas a la API apuntarán
  //     a tu backend real en lugar de a rutas que en Vercel no existen.
  var BACKEND_URL = "";

  // Aplica BACKEND_URL a una ruta relativa (api/..., admin/...) y la deja en
  // formato "URL limpia" (sin .php). En Vercel el firewall bloquea las URLs
  // terminadas en .php; el Caddyfile (contenedor) y el .htaccess (hosting con
  // PHP) resuelven /api/contact -> /api/contact.php.
  var withBackend = function (path) {
    var q = path.indexOf("?");
    var base = q === -1 ? path : path.slice(0, q);
    var query = q === -1 ? "" : path.slice(q);
    base = base.replace(/\.php$/, "");
    return (BACKEND_URL ? BACKEND_URL.replace(/\/$/, "") + "/" + base : base) + query;
  };

  // >>> ENDPOINT DEL FORMULARIO <<<
  // Por defecto usamos el backend propio incluido en este proyecto (PHP), que
  // guarda los mensajes en la base de datos y aplica validación y seguridad.
  // Si prefieres un servicio externo, pon aquí su URL, por ejemplo:
  //     var FORM_ENDPOINT = "https://formspree.io/f/TU_ID";
  // (en ese caso recuerda cambiar también el "action" del <form> en index.html)
  var FORM_ENDPOINT = withBackend("api/contact.php");

  // Base de la API del sitio (datos editables: teléfono, correo, mapa, redes).
  var API_BASE = withBackend("api/");

  // URL del área privada (login / mi cuenta). Se usa para el enlace "Acceder".
  var LOGIN_URL  = withBackend("admin/login.php");
  var ACCOUNT_URL = withBackend("admin/account.php");

  // Datos de contacto de reserva (se usan si la API no responde).
  var CONTACTO = {
    teléfono: "+5359888821",      // [TELÉFONO] principal
    teléfono2: "+5349368808",     // [TELÉFONO] secundario (editable en index.html)
    whatsapp: "5359888821",       // [WHATSAPP] (solo dígitos, con prefijo país)
    correo: "crotulus.mipyme@gmail.com", // [CORREO]
    googleReviews: "",            // [URL_GOOGLE_REVIEWS] (ficha de Google)
    trustpilot: "",               // [URL_TRUSTPILOT] (ficha de Trustpilot)
    empresa: "C-ROTULUS S.U.R.L."
  };

  // Mensaje que aparece ya escrito al abrir WhatsApp:
  var WHATSAPP_MSG = "Hola C-ROTULUS, me gustaría solicitar información sobre sus servicios tecnológicos.";

  /* ==========================================================================
     Utilidades internas
     ========================================================================== */
  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    setupNav();
    setupSmoothScroll();
    setupActiveLink();
    setupReveal();
    setupCounters();
    setupHeaderScroll();
    setupAccordion();
    setupCarousel();
    setupBackTop();
    setupOffscreenPause();  // pausa animaciones decorativas fuera de pantalla
    setupForm();
    setupGoogleReviewsLink();  // enlace «Ver todas en Google» (configurable)
    setupTrustpilotLink();     // enlace «Ver todas en Trustpilot» (configurable)
    cargarGoogleReviews();     // reseñas de Google en vivo (con respaldo en BD)
    cargarTrustpilot();        // reseñas de Trustpilot (con caché en BD)
    // Al recuperar la conexión, reintenta traer las reseñas actualizadas.
    window.addEventListener("online", function () { cargarGoogleReviews(); cargarTrustpilot(); });
    setupWhatsAppLinks();   // valores por defecto (por si la API no responde)
    setupAuthGate();        // carga aportaciones abiertas y, si hay sesión, el enlace de cuenta
    loadSiteData();         // datos reales desde el backend (si está disponible)
    loadContent();          // contenido editable (servicios, proyectos, faq...)
    loadBlog();             // artículos del blog (si hay backend)
    loadTeam();             // miembros del equipo (si hay backend)
    $("#year") && ($("#year").textContent = new Date().getFullYear());
  }

  /* ==========================================================================
     0.c CONTENIDO EDITABLE DESDE LA BASE DE DATOS
     --------------------------------------------------------------------------
     Si en la base de datos hay elementos de un tipo (servicio, proyecto,
     testimonio, faq, proceso), se renderizan aquí. Si no hay ninguno, se
     mantiene el contenido escrito en el HTML (así la web nunca queda vacía).
     ========================================================================== */
  function loadContent() {
    var contenedores = $$("[data-content-list]");
    if (!window.fetch || !contenedores.length) return;

    contenedores.forEach(function (caja) {
      var tipo = caja.getAttribute("data-content-list");
      fetch(API_BASE + "index?resource=content&type=" + encodeURIComponent(tipo), { headers: { "Accept": "application/json" } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data || !data.ok || !data.items || !data.items.length) return; // usamos el HTML
          renderizarTipo(tipo, caja, data.items);
        })
        .catch(function () { /* sin datos: se queda el HTML */ });
    });
  }

  function renderizarTipo(tipo, caja, items) {
    if (tipo === "servicio")  caja.innerHTML = items.map(itemServicio).join("");
    if (tipo === "proyecto")  caja.innerHTML = items.map(itemProyecto).join("");
    if (tipo === "faq")       caja.innerHTML = items.map(itemFaq).join("");
    if (tipo === "proceso")   caja.innerHTML = items.map(itemProceso).join("");
    if (tipo === "testimonio") {
      caja.innerHTML = items.map(itemTestimonio).join("");
      var dots = document.querySelector("#testimonials .carousel-dots");
      if (dots) dots.innerHTML = "";      // evita puntos duplicados
      if (typeof setupCarousel === "function") setupCarousel(); // reinicia el carrusel
    }
    if (tipo === "faq" && typeof setupAccordion === "function") setupAccordion();
    if (tipo === "servicio" || tipo === "proyecto") setupReveal(); // reobserva animaciones
  }

  /* ==========================================================================
     0.d BLOG Y EQUIPO
     --------------------------------------------------------------------------
     Igual que el contenido editable: si la API devuelve datos se pintan aquí;
     si no hay backend, se mantiene el HTML de ejemplo escrito en la página.
     ========================================================================== */
  function loadBlog() {
    var caja = $("[data-blog-list]");
    if (!caja || !window.fetch) return;
    fetch(API_BASE + "index?resource=blog&limit=9", { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.ok || !data.items || !data.items.length) return;
        caja.innerHTML = data.items.map(itemPost).join("");
        setupReveal();
      })
      .catch(function () { /* sin datos: se queda el HTML */ });
  }

  function loadTeam() {
    var caja = $("[data-team-list]");
    if (!caja || !window.fetch) return;
    fetch(API_BASE + "index?resource=team", { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.ok || !data.items || !data.items.length) return;
        caja.innerHTML = data.items.map(itemMiembro).join("");
        setupReveal();
      })
      .catch(function () { /* sin datos: se queda el HTML */ });
  }

  // Fecha "13 oct 2026" a partir de "2026-10-13 05:47:57".
  var MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function fechaCorta(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
    if (!m) return "";
    var mes = parseInt(m[2], 10) - 1;
    return parseInt(m[3], 10) + " " + (MESES[mes] || "") + " " + m[1];
  }

  function itemPost(it) {
    var img = it.image ? it.image : "assets/img/blog/web-que-convierte.jpg";
    var fecha = fechaCorta(it.published_at);
    var meta = [];
    if (it.author) meta.push(esc(it.author));
    if (fecha) meta.push('<time datetime="' + esc(String(it.published_at).slice(0, 10)) + '">' + fecha + "</time>");
    if (it.reading_minutes) meta.push(it.reading_minutes + " min");
    return '<article class="post">'
      + '<a class="post__media" href="#blog" aria-label="Leer: ' + esc(it.title) + '">'
      + fotoResponsive(img, it.title, 800, 500) + '</a>'
      + '<div class="post__body">'
      + (it.category ? '<span class="post__tag">' + esc(it.category) + "</span>" : "")
      + '<h3 class="post__title"><a href="#blog">' + esc(it.title) + "</a></h3>"
      + '<p class="post__text">' + esc(it.excerpt || it.body) + "</p>"
      + '<p class="post__meta">' + meta.join(" &middot; ") + "</p>"
      + "</div></article>";
  }

  function itemMiembro(it) {
    var img = it.avatar ? esc(it.avatar) : "";
    var media = img
      ? '<div class="team-card__media"><img src="' + img + '" alt="Retrato de ' + esc(it.name) + '" width="400" height="400" loading="lazy" decoding="async"></div>'
      : "";
    return '<article class="team-card">' + media
      + '<div class="team-card__body">'
      + '<h3 class="team-card__name">' + esc(it.name) + "</h3>"
      + '<p class="team-card__role">' + esc(it.role) + "</p>"
      + '<p class="team-card__bio">' + esc(it.bio) + "</p>"
      + (it.email ? '<a class="team-card__mail" href="mailto:' + esc(it.email) + '">' + esc(it.email) + "</a>" : "")
      + "</div></article>";
  }

  // Escapa texto antes de insertarlo (defensa contra XSS).
  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  /* Devuelve un <picture> con AVIF y WebP a partir de una ruta .jpg/.png,
     dejando el formato original como respaldo. Si la ruta no termina en una
     extension conocida (p. ej. un SVG) devuelve un <img> normal. */
  function fotoResponsive(src, alt, w, h, cls, loading) {
    if (!src) return "";
    var s = String(src);
    var clsAttr = cls ? ' class="' + esc(cls) + '"' : "";
    var load = loading === "eager" ? "eager" : "lazy";
    if (!/\.(jpe?g|png)$/i.test(s)) {
      return '<img' + clsAttr + ' src="' + esc(s) + '" alt="' + esc(alt) + '"'
        + (w ? ' width="' + w + '" height="' + h + '"' : "")
        + ' loading="' + load + '" decoding="async">';
    }
    var base = s.replace(/\.(jpe?g|png)$/i, "");
    return '<picture>'
      + '<source type="image/avif" srcset="' + esc(base) + '.avif">'
      + '<source type="image/webp" srcset="' + esc(base) + '.webp">'
      + '<img' + clsAttr + ' src="' + esc(s) + '" alt="' + esc(alt) + '"'
      + ' width="' + w + '" height="' + h + '" loading="' + load + '" decoding="async">'
      + '</picture>';
  }

  function iniciales(nombre) {
    return esc(String(nombre || "?").trim().split(/\s+/).slice(0, 2).map(function (p) { return p[0]; }).join("").toUpperCase());
  }
  var ICONO_SVG = '<svg viewBox="0 0 24 24" width="26" height="26"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6l7-3Z"/></svg>';

  function itemServicio(it) {
    return '<article class="card"><div class="card__icon" aria-hidden="true">' + ICONO_SVG + '</div>'
      + '<h3 class="card__title">' + esc(it.title) + '</h3>'
      + '<p class="card__text">' + esc(it.body || it.subtitle) + '</p>'
      + '<a class="btn btn--ghost" href="#contacto" data-service="' + esc(it.title) + '">Consultar</a></article>';
  }
  function itemProyecto(it) {
    var meta = it.meta || {};
    var img  = meta.image ? meta.image : "assets/img/proyecto-web.jpg";
    return '<article class="project"><div class="project__media">' + fotoResponsive(img, it.title, 800, 500) + '</div>'
      + '<div class="project__body"><span class="project__tag">' + esc(it.subtitle) + '</span>'
      + '<h3 class="project__title">' + esc(it.title) + '</h3>'
      + '<p class="project__text">' + esc(it.body) + '</p>'
      + '<a class="project__link" href="#contacto">Ver caso &rarr;</a></div></article>';
  }
  function itemTestimonio(it) {
    var meta = it.meta || {};
    var avatar = meta.photo
      ? fotoResponsive(meta.photo, "Foto de " + it.title, 96, 96, "testimonial__avatar")
      : '<span class="testimonial__avatar" aria-hidden="true">' + iniciales(it.title) + '</span>';
    var estrellas = meta.rating ? Math.max(1, Math.min(5, parseInt(meta.rating, 10) || 5)) : 5;
    var rating = '<span class="testimonial__rating" role="img" aria-label="Valoración: ' + estrellas + ' de 5 estrellas">'
      + new Array(estrellas + 1).join('<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="m12 2 3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z"/></svg>')
      + '</span>';
    var badge = '<span class="testimonial__badge">'
      + '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m5 12 5 5L20 6"/></svg>'
      + 'Cliente verificado</span>';
    var resultado = meta.resultado
      ? '<p class="testimonial__result">' + esc(meta.resultado) + '</p>' : '';
    return '<li class="testimonial"><blockquote class="testimonial__quote">'
      + '<div class="testimonial__top">' + rating + badge + '</div>'
      + '<p class="testimonial__text">&laquo;' + esc(it.body) + '&raquo;</p>'
      + resultado
      + '</blockquote>'
      + '<footer class="testimonial__author">' + avatar
      + '<cite><strong>' + esc(it.title) + '</strong><span>' + esc(it.subtitle || meta.cargo || "") + '</span></cite></footer></li>';
  }
  function itemFaq(it) {
    var id = "faq-" + esc(it.id);
    return '<div class="accordion__item"><h3 class="accordion__heading">'
      + '<button class="accordion__trigger" type="button" aria-expanded="false" aria-controls="' + id + '">' + esc(it.title)
      + '<span class="accordion__icon" aria-hidden="true"></span></button></h3>'
      + '<div class="accordion__panel" id="' + id + '" role="region"><p>' + esc(it.body) + '</p></div></div>';
  }
  function itemProceso(it, idx) {
    return '<li class="step"><span class="step__num" aria-hidden="true">' + (idx + 1) + '</span>'
      + '<h3 class="step__title">' + esc(it.title) + '</h3>'
      + '<p class="step__text">' + esc(it.body || it.subtitle) + '</p></li>';
  }

  /* ==========================================================================
     0.b DATOS DEL SITIO DESDE LA API (PHP + BASE DE DATOS)
     --------------------------------------------------------------------------
     Si el backend responde, sustituye teléfono, correo, dirección, redes y el
     mapa por los valores guardados en el panel. Si falla, no pasa nada: la web
     se queda con los valores escritos en index.html.
     ========================================================================== */
  function loadSiteData() {
    if (!window.fetch) return;
    fetch(API_BASE + "index?resource=settings", { headers: { "Accept": "application/json" } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || !data.ok || !data.settings) return;
        aplicarAjustes(data.settings);
      })
      .catch(function () { /* sin backend: seguimos con los valores por defecto */ });
  }

  function aplicarAjustes(s) {
    var tel = s.telefono || "", correo = s.correo || "";
    var direccion = ((s.direccion || "") + (s.ciudad ? ", " + s.ciudad : "")).trim();

    // Enlaces tel:/mailto: de toda la página.
    // El teléfono secundario (data-tel-secondary) conserva su propio número.
    $$('a[href^="tel:"]').forEach(function (a) {
      if (a.hasAttribute("data-tel-secondary")) return;
      if (tel && tel.indexOf("[") === -1) a.setAttribute("href", "tel:" + tel.replace(/[^\d+]/g, ""));
    });
    $$('a[href^="mailto:"]').forEach(function (a) {
      // No tocamos los correos propios del equipo (tienen su dirección fija).
      if (a.classList.contains("team-card__mail")) return;
      if (correo && correo.indexOf("[") === -1) a.setAttribute("href", "mailto:" + correo);
    });

    // Textos marcados con data-site="clave"
    $$("[data-site]").forEach(function (el) {
      var key = el.getAttribute("data-site");
      if (s[key] !== undefined && String(s[key]).trim() !== "") el.textContent = s[key];
    });
    if (direccion) {
      $$("[data-site-direccion]").forEach(function (el) { el.textContent = direccion; });
    }

    // Titular del hero: texto + palabra destacada con degradado
    $$("[data-site-title]").forEach(function (el) {
      var texto = s[el.getAttribute("data-site-title")];
      if (texto === undefined || String(texto).trim() === "") return;
      var accent = s[el.getAttribute("data-site-accent")] || "";
      el.textContent = "";
      if (accent && String(texto).indexOf(accent) !== -1) {
        var partes = String(texto).split(accent);
        el.appendChild(document.createTextNode(partes[0]));
        var span = document.createElement("span");
        span.className = "text-accent";
        span.textContent = accent;
        el.appendChild(span);
        el.appendChild(document.createTextNode(partes.slice(1).join(accent)));
      } else {
        el.textContent = texto;
      }
    });

    // Cifras de confianza (valor numérico + etiqueta)
    $$("[data-site-stat]").forEach(function (li) {
      var i = li.getAttribute("data-site-stat");
      var val = s["stat" + i + "_value"], lbl = s["stat" + i + "_label"];
      if (val !== undefined && String(val).trim() !== "") {
        var num = li.querySelector(".stat__num");
        if (num) {
          var n = parseInt(String(val).replace(/\D/g, ""), 10);
          if (!isNaN(n)) { num.setAttribute("data-count", n); animarStat(num); }
        }
      }
      if (lbl !== undefined && String(lbl).trim() !== "") {
        var lab = li.querySelector(".stat__label");
        if (lab) lab.textContent = lbl;
      }
    });

    // Imágenes editables (hero y equipo): src y texto alternativo. Si la imagen
    // va dentro de un <picture>, se regeneran tambien las fuentes AVIF/WebP para
    // que el cambio del panel no quede anulado por un <source> obsoleto.
    $$("[data-site-image]").forEach(function (img) {
      var ruta = s[img.getAttribute("data-site-image")];
      var alt  = s[img.getAttribute("data-site-alt")];
      if (ruta !== undefined && String(ruta).trim() !== "") {
        img.setAttribute("src", ruta);
        var pic = img.closest("picture");
        if (pic) {
          var base = String(ruta).replace(/\.(jpe?g|png)$/i, "");
          var fuentes = pic.querySelectorAll("source");
          if (fuentes.length >= 2 && /\.(jpe?g|png)$/i.test(String(ruta))) {
            fuentes[0].setAttribute("srcset", base + ".avif");
            fuentes[1].setAttribute("srcset", base + ".webp");
          } else {
            fuentes.forEach(function (f) { f.remove(); });
          }
        }
      }
      if (alt !== undefined && String(alt).trim() !== "") img.setAttribute("alt", alt);
    });

    // Enlaces legales del pie: texto plano separado por «·», cada uno a contacto
    $$("[data-footer-legal]").forEach(function (el) {
      var texto = s.footer_legal;
      if (texto === undefined || String(texto).trim() === "") return;
      el.textContent = "";
      String(texto).split("·").forEach(function (parte, i) {
        var t = parte.trim();
        if (t === "") return;
        if (i > 0) el.appendChild(document.createTextNode(" · "));
        var a = document.createElement("a");
        a.href = "#contacto";
        a.textContent = t;
        el.appendChild(a);
      });
    });

    // Redes sociales
    ["facebook", "instagram", "linkedin", "github"].forEach(function (red) {
      var valor = s[red] || "";
      if (!valor || valor.indexOf("[") !== -1) return;
      $$('[data-social="' + red + '"]').forEach(function (a) { a.setAttribute("href", valor); });
    });

    // Mapa: si hay URL de embed configurada, sustituye la imagen por el iframe
    if (s.mapa_embed && /^https:\/\//.test(s.mapa_embed)) {
      var cont = $("#contactMap");
      if (cont) {
        cont.innerHTML = '<iframe src="' + s.mapa_embed + '" width="100%" height="360" style="border:0" '
          + 'loading="lazy" title="Mapa de ubicación de C-ROTULUS" '
          + 'referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>';
      }
    }
    // Enlace «Cómo llegar»
    if (s.google_maps_url && /^https:\/\//.test(s.google_maps_url)) {
      $$("[data-maps-link]").forEach(function (a) { a.setAttribute("href", s.google_maps_url); });
    }

    // Actualiza WhatsApp con el número real y vuelve a aplicar los enlaces
    if (s.whatsapp) CONTACTO.whatsapp = String(s.whatsapp).replace(/\D/g, "");
    if (s.correo) CONTACTO.correo = s.correo;
    if (s.telefono) CONTACTO.teléfono = s.telefono;
    if (s.google_reviews_url) CONTACTO.googleReviews = String(s.google_reviews_url);
    if (s.trustpilot_url) CONTACTO.trustpilot = String(s.trustpilot_url);
    setupWhatsAppLinks();
    setupGoogleReviewsLink();   // enlace «Ver todas en Google»
    setupTrustpilotLink();      // enlace «Ver todas en Trustpilot»


    // Modo mantenimiento: aviso visible y formulario desactivado
    if (String(s.maintenance_mode) === "1") {
      mostrarMantenimiento(s.maintenance_message || "Estamos mejorando la web. Volvemos en unos minutos.");
    }

    // Visibilidad de los bloques de valoraciones (se activan/desactivan de forma
    // independiente desde el panel). Cada sección lleva data-section-toggle="clave";
    // al ocultarla se quitan también su enlace del menú y del pie.
    aplicarSeccionesVisibles(s);

    // SEO editable: sobreescribe título, descripción y datos de compartir
    aplicarSeo(s);

  }

  /* ==========================================================================
     VISIBILIDAD DE SECCIONES DE VALORACIONES
     --------------------------------------------------------------------------
     El panel guarda "testimonials_enabled", "google_reviews_enabled" y
     "trustpilot_enabled" ("1"/"0"). Cada <section> de la portada declara su
     clave con data-section-toggle. Si está a "0", se oculta la sección y los
     enlaces (menú, pie) que apuntan a su ancla. Si la clave no llega (backend
     sin respuesta), todo se queda visible.
     ========================================================================== */
  function aplicarSeccionesVisibles(s) {
    var huboCambio = false;
    $$("[data-section-toggle]").forEach(function (sec) {
      var key = sec.getAttribute("data-section-toggle");
      var valor = s[key];
      if (valor === undefined) return;               // sin dato: no tocar
      var visible = String(valor) !== "0";
      sec.hidden = !visible;
      huboCambio = true;
      if (!visible) {
        var id = sec.getAttribute("id");
        if (id) {
          $$('a[href="#' + id + '"], a[href$="#' + id + '"]').forEach(function (a) {
            var li = a.closest("li");
            (li || a).hidden = true;
          });
        }
      }
    });
    // Al ocultar un bloque pueden quedar dos secciones azules seguidas (p. ej.
    // «proceso» + «valoraciones»), lo que rompe la alternancia del diseno. Se
    // devuelve a gris suave la segunda azul de cada pareja contigua.
    if (huboCambio) normalizarFondos();
  }

  function esAzul(sec) {
    return sec.classList.contains("section--blue") || sec.classList.contains("section--alt");
  }

  function normalizarFondos() {
    var main = document.querySelector("main");
    if (!main) return;
    var previaAzul = false;
    $$("section.section", main).forEach(function (sec) {
      if (sec.hidden) return;
      if (esAzul(sec)) {
        if (previaAzul) {
          sec.classList.remove("section--blue", "section--alt");
          sec.classList.add("section--soft");
        } else {
          previaAzul = true;
        }
      } else {
        previaAzul = false;
      }
    });
  }

  /* Aplica al <head> los textos de SEO guardados en el panel. */
  function aplicarSeo(s) {
    function setMeta(sel, attr, value) {
      if (!value) return;
      var el = document.querySelector(sel);
      if (el) el.setAttribute(attr, value);
    }
    var name = s.site_name || "";
    if (name) {
      document.title = name + " | Servicios tecnológicos para empresas";
      setMeta('meta[data-seo-name]', "content", name);
    }
    if (s.meta_description) {
      setMeta('meta[data-seo-desc]', "content", s.meta_description);
      setMeta('meta[data-seo-ogdesc]', "content", s.meta_description);
    }
    if (s.meta_keywords) {
      setMeta('meta[data-seo-keywords]', "content", s.meta_keywords);
    }
    if (s.site_url) {
      var base = String(s.site_url).replace(/\/+$/, "");
      setMeta('meta[data-seo-url]', "content", base + "/");
      var canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) canonical.setAttribute("href", base + "/");
    }
    if (s.og_image) {
      var img = /^https?:\/\//.test(s.og_image)
        ? s.og_image
        : ((s.site_url || "").replace(/\/+$/, "") + "/" + String(s.og_image).replace(/^\/+/, ""));
      document.querySelectorAll('meta[data-seo-image]').forEach(function (m) { m.setAttribute("content", img); });
    }
  }

  /* Aviso de mantenimiento: se muestra sobre la página y bloquea el formulario. */
  function mostrarMantenimiento(mensaje) {
    if ($("#maintenanceBanner")) return;
    var bar = document.createElement("div");
    bar.id = "maintenanceBanner";
    bar.className = "maintenance-banner";
    bar.setAttribute("role", "status");
    bar.innerHTML = '<strong>Modo mantenimiento:</strong> ' + mensaje;
    document.body.insertBefore(bar, document.body.firstChild);
    var form = $("#contactForm");
    if (form) {
      $$("input, textarea, select, button", form).forEach(function (el) { el.disabled = true; });
    }
  }

  /* ==========================================================================
     0.d APORTACIONES Y RANKING DE FAQ
     --------------------------------------------------------------------------
     - Los formularios para enviar testimonios o proponer preguntas viven en el
       área privada (admin/account.php), disponible al iniciar sesión. Así la
       web pública solo muestra contenido de personas identificadas.
     - La API ?resource=faqs devuelve las preguntas ordenadas por importancia;
       la portada muestra primero las más relevantes.
     - Aquí solo cargamos contenido y, si hay sesión, adaptamos el enlace de
       cabecera a "Mi cuenta".
     ========================================================================== */
  function setupAuthGate() {
    cargarRankingFaq();
    cargarTestimoniosUsuarios();

    // El enlace "Acceder" de la cabecera apunta al backend real (BACKEND_URL).
    // Así, si el sitio está en un hosting estático (Vercel) y el panel en otro
    // con PHP, el enlace sigue funcionando.
    var navAuth = document.getElementById("navAuthLink");
    if (navAuth) navAuth.setAttribute("href", LOGIN_URL);
    reescribirEnlacesAdmin();

    if (!window.fetch) return;
    // Si hay sesión, el enlace de cabecera pasa a "Mi cuenta".
    fetch(API_BASE + "index?resource=session", { headers: { "Accept": "application/json" }, credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var loggedIn = !!(data && data.ok && data.logged_in);
        var navLink = document.getElementById("navAuthLink");
        if (navLink) {
          navLink.textContent = loggedIn ? "Mi cuenta" : "Acceder";
          navLink.setAttribute("href", loggedIn ? ACCOUNT_URL : LOGIN_URL);
        }
        cargarTestimoniosUsuarios(true);
      })
      .catch(function () { /* sin sesión: la web funciona igual */ });
  }

  // Reescribe en el HTML todos los enlaces que apuntan al área privada
  // (admin/login.php, admin/account.php) para que usen BACKEND_URL. Así el
  // sitio estático en Vercel enlaza con el panel PHP real, sin enlaces rotos.
  function reescribirEnlacesAdmin() {
    if (!BACKEND_URL) return;
    $$('a[href^="admin/"]').forEach(function (a) {
      a.setAttribute("href", withBackend(a.getAttribute("href")));
    });
  }

  // Carga el ranking de FAQ (algoritmo de importancia) en el acordeón.
  function cargarRankingFaq() {
    var caja = document.querySelector("[data-faq-ranked]");
    if (!caja || !window.fetch) return;
    fetch(API_BASE + "index?resource=faqs", { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.ok || !data.items || !data.items.length) return;
        caja.innerHTML = data.items.map(itemFaq).join("");
        if (typeof setupAccordion === "function") setupAccordion();
      })
      .catch(function () { /* sin datos: se mantienen las FAQ del HTML */ });
  }

  // Añade los testimonios aprobados de usuarios registrados a la lista.
  function cargarTestimoniosUsuarios(forzar) {
    var track = document.querySelector(".testimonials__track");
    if (!track || !window.fetch) return;
    fetch(API_BASE + "index?resource=testimonials", { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.ok || !data.items || !data.items.length) return;
        $$("[data-user-testimonial]", track).forEach(function (li) { li.remove(); });
        var html = data.items.map(function (t) {
          var avatar = t.photo
            ? fotoResponsive(t.photo, "Foto de " + t.author_name, 96, 96)
            : '<span class="testimonial__avatar" aria-hidden="true">' + iniciales(t.author_name) + '</span>';
          return '<li class="testimonial" data-user-testimonial><blockquote class="testimonial__quote"><p>"'
            + esc(t.comment) + '"</p></blockquote><footer class="testimonial__author">' + avatar
            + '<cite><strong>' + esc(t.author_name) + '</strong><span>Cliente</span></cite></footer></li>';
        }).join("");
        track.insertAdjacentHTML("beforeend", html);
        if (typeof setupCarousel === "function") setupCarousel();
      })
      .catch(function () { /* sin testimonios de usuarios */ });
  }

  /* ==========================================================================
     1. MENÚ HAMBURGUESA (MÓVIL)
     ========================================================================== */
  function setupNav() {
    var toggle = $("#navToggle");
    var nav = $("#primaryNav");
    if (!toggle || !nav) return;

    function close() {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Abrir menú de navegación");
    }
    function open() {
      nav.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Cerrar menú de navegación");
    }

    toggle.addEventListener("click", function () {
      nav.classList.contains("is-open") ? close() : open();
    });

    // Al pulsar un enlace se cierra el menú (en móvil)
    $$(".nav-link", nav).forEach(function (link) {
      link.addEventListener("click", close);
    });

    // Cerrar con la tecla Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        close();
        toggle.focus();
      }
    });

    // Al pasar a escritorio, restablecer el estado
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 900) close();
    });
  }

  /* ==========================================================================
     2. SCROLL SUAVE y ENLACE ACTIVO SEGUN SECCIÓN VISIBLE
     ========================================================================== */
  function setupSmoothScroll() {
    // Normaliza el href al abrir la página: si venimos de otra página con
    // "index.html#servicios", el navegador salta a la sección y luego limpiamos
    // la URL a "#servicios" para que el enlace activo funcione bien.
    if (location.hash && location.pathname.indexOf("index.html") !== -1) {
      history.replaceState(null, "", location.hash);
    }

    $$('a[href^="#"], a[href$=".html"], a[href*=".html#"]').forEach(function (link) {
      link.addEventListener("click", function (e) {
        var href = link.getAttribute("href") || "";
        if (href === "#") return;

        var hashPos = href.indexOf("#");
        var ruta = hashPos === -1 ? href : href.slice(0, hashPos);
        var id = hashPos === -1 ? "" : href.slice(hashPos);

        // Sin ancla, o con ruta absoluta/externa: navegación normal.
        if (!id) return;
        if (ruta && (ruta.indexOf("http") === 0 || ruta.indexOf("/") === 0)) return;

        // Si el ancla pertenece a otra página, dejamos que el navegador navegue.
        if (ruta) {
          var actual = location.pathname.split("/").pop() || "index.html";
          if (ruta !== actual) return;
        }

        var target = null;
        try { target = document.querySelector(id); } catch (err) { return; }
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({
          behavior: prefersReduced ? "auto" : "smooth",
          block: "start"
        });
        // Actualiza la URL sin recargar
        history.replaceState(null, "", id);
      });
    });
  }

  function setupActiveLink() {
    // Solo enlaces internos de esta página ("#ancla"). Los enlaces a otras
    // páginas (empresa.html) o a admin/login.php se ignoran para no pasar
    // valores no-ancla a querySelector (lanzaría un SyntaxError).
    var links = $$(".nav-link").filter(function (l) {
      var href = l.getAttribute("href") || "";
      return href.charAt(0) === "#" && href.length > 1;
    });
    var sections = links
      .map(function (l) { return document.querySelector(l.getAttribute("href")); })
      .filter(Boolean);
    if (!sections.length) return;

    function setActive(id) {
      links.forEach(function (l) {
        l.classList.toggle("is-active", l.getAttribute("href") === "#" + id);
      });
    }

    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
      sections.forEach(function (s) { observer.observe(s); });
    }
  }

  /* ==========================================================================
     3. ANIMACIONES DE APARICION AL HACER SCROLL
     ========================================================================== */
  function setupReveal() {
    var items = $$(".section__head, .card, .project, .step, .mv-card, .stat, .about__media, .about__body, .testimonial, .accordion, .contact-form, .contact-info, .team-card, .post");
    if (!items.length) return;

    items.forEach(function (el) { el.classList.add("reveal"); });

    function reveal(el) { el.classList.add("is-visible"); }

    if (!("IntersectionObserver" in window) || prefersReduced) {
      items.forEach(reveal);
      return;
    }

    /* Activamos la animacion SOLO aqui: si este JS no se ejecuta (o es una
       version antigua en cache), el CSS deja el contenido visible por defecto. */
    document.documentElement.classList.add("has-reveal-anim");

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          reveal(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: .12 });

    items.forEach(function (el) { observer.observe(el); });

    /* Red de seguridad: nunca dejamos contenido oculto. Si el observer no
       revela un elemento (al abrir la web directamente en un ancla, al usar
       el teclado, o por cualquier fallo), lo mostramos igualmente. */
    function revealInView() {
      items.forEach(function (el) {
        if (el.classList.contains("is-visible")) return;
        var r = el.getBoundingClientRect();
        if (r.top < (window.innerHeight || 0) + 100 && r.bottom > -100) reveal(el);
      });
    }
    window.addEventListener("load", revealInView);
    window.addEventListener("hashchange", function () { setTimeout(revealInView, 400); });
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { revealInView(); ticking = false; });
    }, { passive: true });
    setTimeout(revealInView, 400);
    setTimeout(function () { items.forEach(reveal); }, 3000); // colchón final
  }

  /* ==========================================================================
     3b. CABECERA CON SOMBRA AL HACER SCROLL
     ========================================================================== */
  function setupHeaderScroll() {
    var header = $(".site-header");
    if (!header) return;
    var ticking = false;
    function update() {
      header.classList.toggle("is-scrolled", window.scrollY > 12);
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  /* ==========================================================================
     3d. PAUSA DE ANIMACIONES FUERA DE PANTALLA
     --------------------------------------------------------------------------
     Las capas decorativas animadas (puntos "estrellas", halos y blobs) solo
     consumen CPU/GPU mientras son visibles. Con IntersectionObserver se pausa
     su animación cuando salen del viewport y se reanuda al volver a entrar.
     Así el scroll y el consumo de batería mejoran sin cambiar el aspecto.
     ========================================================================== */
  function setupOffscreenPause() {
    if (prefersReduced || !("IntersectionObserver" in window)) return;

    // IntersectionObserver no acepta pseudo-elementos: observamos las cajas
    // reales que los contienen y marcamos la pausa con una clase en la sección.
    var cajas = $$(".hero, .section--alt, .section--blue, .site-footer, .bg-fx");
    if (!cajas.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        entry.target.classList.toggle("is-offscreen", !entry.isIntersecting);
      });
    }, { rootMargin: "150px 0px" });

    cajas.forEach(function (caja) { observer.observe(caja); });
  }

  /* ==========================================================================
     4. CONTADOR ANIMADO DE LAS CIFRAS DE CONFIANZA
     ========================================================================== */
  function setupCounters() {
    var nums = $$(".stat__num");
    if (!nums.length || prefersReduced || !("IntersectionObserver" in window)) return;

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        animarStat(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: .5 });

    nums.forEach(function (n) { observer.observe(n); });
  }

  /* Anima una cifra hasta el valor de data-count (y deja el "+" final).
     Se usa al entrar en pantalla y también al aplicar valores de la BD. */
  function animarStat(el) {
    var target = parseInt(el.getAttribute("data-count"), 10) || 0;
    if (prefersReduced) { el.textContent = target + "+"; return; }
    var duration = 1200, start = null;
    requestAnimationFrame(function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      el.textContent = Math.floor(p * target) + (p === 1 ? "+" : "");
      if (p < 1) requestAnimationFrame(step);
    });
  }

  /* ==========================================================================
     5. ACORDEÓN DE PREGUNTAS FRECUENTES
     ========================================================================== */
  function setupAccordion() {
    var triggers = $$(".accordion__trigger");
    if (!triggers.length) return;

    triggers.forEach(function (trigger) {
      var panel = document.getElementById(trigger.getAttribute("aria-controls"));

      trigger.addEventListener("click", function () {
        var isOpen = trigger.getAttribute("aria-expanded") === "true";
        // Cierra todos (comportamiento de acordeón simple)
        triggers.forEach(function (t) {
          t.setAttribute("aria-expanded", "false");
          var p = document.getElementById(t.getAttribute("aria-controls"));
          if (p) p.style.maxHeight = null;
        });
        // Abre el pulsado si estaba cerrado
        if (!isOpen) {
          trigger.setAttribute("aria-expanded", "true");
          if (panel) panel.style.maxHeight = panel.scrollHeight + "px";
        }
      });
    });
  }

  /* ==========================================================================
     6. CARRUSEL DE TESTIMONIOS
     ========================================================================== */
  function setupCarousel() {
    var root = $("#testimonials");
    if (!root) return;
    var track = $(".testimonials__track", root);
    var slides = $$(".testimonial", root);
    var dotsBox = $(".carousel-dots", root);
    if (!track || slides.length < 2) return;

    var index = 0;

    // Crea los puntos de navegación
    var dots = slides.map(function (_, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-label", "Ir al testimonio " + (i + 1));
      b.addEventListener("click", function () { go(i); });
      dotsBox.appendChild(b);
      return b;
    });

    function go(i) {
      index = (i + slides.length) % slides.length;
      track.style.transform = "translateX(-" + index * 100 + "%)";
      slides.forEach(function (s, k) { s.setAttribute("aria-hidden", k === index ? "false" : "true"); });
      dots.forEach(function (d, k) { d.setAttribute("aria-selected", k === index ? "true" : "false"); });
    }

    $$("[data-carousel]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        go(index + (btn.getAttribute("data-carousel") === "next" ? 1 : -1));
      });
    });

    // Gesto tactil basico (swipe)
    var startX = 0;
    track.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener("touchend", function (e) {
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 45) go(index + (dx < 0 ? 1 : -1));
    });

    // Autoplay que se detiene al interactuar o al salir de la pestana
    var timer = null;
    function play() { if (!prefersReduced) timer = setInterval(function () { go(index + 1); }, 6000); }
    function stop() { clearInterval(timer); }
    root.addEventListener("mouseenter", stop);
    root.addEventListener("focusin", stop);
    root.addEventListener("mouseleave", play);
    document.addEventListener("visibilitychange", function () { document.hidden ? stop() : play(); });

    go(0);
    play();
  }

  /* ==========================================================================
     7. BOTÓN "VOLVER ARRIBA"
     ========================================================================== */
  function setupBackTop() {
    var btn = $("#backTop");
    if (!btn) return;

    function onScroll() {
      var show = window.scrollY > 500;
      btn.hidden = false;
      btn.classList.toggle("is-visible", show);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
    });
  }

  /* ==========================================================================
     8. FORMULARIO: VALIDACIÓN + ENVÍO AL SERVICIO EXTERNO
     ========================================================================== */
  function setupForm() {
    var form = $("#contactForm");
    if (!form) return;
    var status = $("#formStatus");
    cargarCaptcha();

    // Reglas de validación por campo
    var reglas = {
      nombre:   { req: true, msg: "Escribe tu nombre." },
      correo:   { req: true, email: true, msg: "Escribe un correo válido." },
      telefono: { req: true, tel: true, msg: "Escribe un teléfono válido (mín. 9 dígitos)." },
      servicio: { req: true, msg: "Selecciona un servicio." },
      mensaje:  { req: true, min: 10, msg: "Cuéntanos un poco más (mín. 10 caracteres)." },
      captcha:  { req: true, num: true, msg: "Resuelve la operacion de seguridad." }
    };

    function setError(input, msg) {
      var box = $('[data-error-for="' + input.id + '"]', form);
      if (msg) {
        input.setAttribute("aria-invalid", "true");
        if (box) box.textContent = msg;
        return false;
      }
      input.removeAttribute("aria-invalid");
      if (box) box.textContent = "";
      return true;
    }

    function validar(input) {
      var r = reglas[input.name];
      if (!r) return true;
      var v = input.value.trim();

      if (r.req && v === "") return setError(input, r.msg);
      if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return setError(input, r.msg);
      if (r.tel && (v.replace(/[^\d]/g, "").length < 9)) return setError(input, r.msg);
      if (r.num && !/^-?\d+$/.test(v)) return setError(input, r.msg);
      if (r.min && v.length < r.min) return setError(input, r.msg);
      return setError(input, "");
    }

    // Botón para generar otro reto de seguridad
    var refresh = $("#captchaRefresh");
    if (refresh) refresh.addEventListener("click", cargarCaptcha);

    // Validación al salir del campo
    $$("input, select, textarea", form).forEach(function (el) {
      if (!reglas[el.name]) return;
      el.addEventListener("blur", function () { validar(el); });
      el.addEventListener("input", function () {
        if (el.getAttribute("aria-invalid") === "true") validar(el);
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var campos = $$("input, select, textarea", form).filter(function (el) { return reglas[el.name]; });

      // Valida todos
      var ok = true, primero = null;
      campos.forEach(function (el) {
        if (!validar(el)) { ok = false; if (!primero) primero = el; }
      });
      if (!ok) {
        status.textContent = "Revisa los campos marcados en rojo.";
        status.className = "form-status is-error";
        primero && primero.focus();
        return;
      }

      // Anti-spam: si el campo trampa tiene valor, simulamos exito y no enviamos.
      if (form.querySelector('[name="_gotcha"]').value !== "") {
        status.textContent = "Mensaje enviado. Gracias.";
        status.className = "form-status is-success";
        form.reset();
        return;
      }

      // Envío al endpoint (backend propio o servicio externo compatible)
      status.textContent = "Enviando...";
      status.className = "form-status";

      // Si es un servicio externo sin configurar, avisamos en vez de fallar en silencio.
      if (FORM_ENDPOINT.indexOf("TU_ID") !== -1) {
        status.textContent = "Formulario no configurado: sustituye TU_ID en js/main.js y en el action del formulario.";
        status.className = "form-status is-error";
        return;
      }

      enviarFormulario(form, status);
    });
  }

  /* Pide un reto anti-spam a la API y lo pinta en el formulario.
     El reto y su firma los genera el servidor (no se puede falsificar). */
  function cargarCaptcha() {
    var q = $("#captchaQuestion");
    var token = $("#captchaToken");
    var campo = $("#captcha");
    if (!q || !token) return;

    q.textContent = "Cargando reto…";
    fetch(API_BASE + "index?action=captcha", { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok && d.challenge) {
          q.textContent = d.challenge;
          token.value = d.token || "";
          if (campo) campo.value = "";
        } else {
          q.textContent = "Verificacion no disponible";
        }
      })
      .catch(function () { q.textContent = "Verificacion no disponible"; });
  }

  /* Envía el formulario al backend. Obtiene un token CSRF antes de enviar
     (protección contra falsificación de peticiones) y muestra éxito o error. */
  function enviarFormulario(form, status) {
    var datos = new FormData(form);

    obtenerCsrf()
      .then(function (token) {
        return fetch(FORM_ENDPOINT, {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "X-CSRF-Token": token || ""
          },
          body: datos
        });
      })
      .then(function (res) { return res.json().catch(function () { return { ok: res.ok }; }); })
      .then(function (data) {
        if (data && data.ok) {
          status.textContent = "Gracias, hemos recibido tu mensaje. Te responderemos en menos de 24 horas laborables.";
          status.className = "form-status is-success";
          form.reset();
          cargarCaptcha();
          return;
        }
        // Errores por campo devueltos por el backend
        if (data && data.fields) {
          Object.keys(data.fields).forEach(function (name) {
            var el = form.querySelector('[name="' + name + '"]');
            if (el) setFieldError(form, el, data.fields[name]);
          });
        }
        status.textContent = (data && data.error) || "No se pudo enviar. Inténtalo de nuevo o escríbenos por WhatsApp.";
        status.className = "form-status is-error";
        cargarCaptcha();
      })
      .catch(function () {
        status.textContent = "No se pudo enviar. Inténtalo de nuevo o escríbenos por WhatsApp.";
        status.className = "form-status is-error";
        cargarCaptcha();
      });
  }

  /* Pide un token CSRF a la API (lo guarda en la sesión del servidor). */
  function obtenerCsrf() {
    return fetch(API_BASE + "index?action=csrf", { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (d) { return (d && d.csrf_token) || ""; })
      .catch(function () { return ""; });
  }

  /* Marca el error de un campo concreto. */
  function setFieldError(form, input, msg) {
    var box = form.querySelector('[data-error-for="' + input.id + '"]');
    if (msg) {
      input.setAttribute("aria-invalid", "true");
      if (box) box.textContent = msg;
    }
  }

  /* ==========================================================================
     9. ENLACES DE WHATSAPP CON MENSAJE PRELLENADO
     ========================================================================== */
  function setupWhatsAppLinks() {
    var url = "https://wa.me/" + CONTACTO.whatsapp + "?text=" + encodeURIComponent(WHATSAPP_MSG);
    $$("[data-whatsapp-link]").forEach(function (a) {
      a.setAttribute("href", url);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener");
    });
  }

  /* ==========================================================================
     9.b ENLACE «VER TODAS EN GOOGLE»
     --------------------------------------------------------------------------
     El enlace de la sección de Opiniones apunta al marcador
     [URL_GOOGLE_REVIEWS] del HTML. Aquí se sustituye por la URL real de la
     ficha de Google configurada en el panel (Ajustes · Reseñas). Si aún no hay
     URL válida, se mantiene el marcador para editarlo a mano en el HTML.
     ========================================================================== */
  function setupGoogleReviewsLink() {
    var url = (typeof CONTACTO !== "undefined" && CONTACTO.googleReviews) || "";
    if (!url || url.indexOf("[") !== -1) return;
    $$("[data-google-reviews-link]").forEach(function (a) {
      a.setAttribute("href", url);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener");
    });
  }

  /* Enlace «Ver todas en Trustpilot» de la sección de reseñas verificadas. */
  function setupTrustpilotLink() {
    var url = (typeof CONTACTO !== "undefined" && CONTACTO.trustpilot) || "";
    if (!url || url.indexOf("[") !== -1) return;
    $$("[data-trustpilot-link]").forEach(function (a) {
      a.setAttribute("href", url);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener");
    });
  }

  /* ==========================================================================
     9.c RESEÑAS DE GOOGLE EN VIVO (con respaldo en la base de datos)
     --------------------------------------------------------------------------
     La sección «Opiniones» pide las reseñas reales al backend
     (?resource=google_reviews). El backend las guarda en la base de datos y,
     si no hay conexión con Google, devuelve las últimas 3 que ya tenía
     guardadas. Así la sección nunca queda vacía:
       - Con conexión  -> reseñas actualizadas (data.live = true).
       - Sin conexión  -> últimas 3 guardadas + aviso «mostrando las últimas».
       - Al volver la conexión (evento "online") -> se reintenta y se actualiza.
     ========================================================================== */
  function cargarGoogleReviews() {
    var lista = document.querySelector("[data-gr-list]");
    if (!lista || !window.fetch) return;

    fetch(API_BASE + "index?resource=google_reviews", { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.ok) return;

        // Sin reseñas disponibles: se mantienen las del HTML.
        if (!data.items || !data.items.length) return;

        pintarGoogleReviews(data);
      })
      .catch(function () { /* sin backend: se quedan las reseñas del HTML */ });
  }

  function pintarGoogleReviews(data) {
    var lista = document.querySelector("[data-gr-list]");
    if (!lista) return;

    lista.innerHTML = data.items.map(function (r) {
      var n = Math.max(0, Math.min(5, parseInt(r.rating, 10) || 0));
      var stars = "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
      var cuando = r.relative_time || "";
      return '<li class="review-card review-card--google">'
        + '<div class="review-card__head">'
        + '<span class="review-card__author">' + esc(r.author_name) + '</span>'
        + '<span class="stars stars--sm" aria-label="' + n + ' de 5 estrellas" title="' + n + '/5">' + stars + '</span>'
        + '</div>'
        + '<div class="review-card__meta">'
        + '<span class="review-card__source review-card__source--google">' + ICONO_GOOGLE + 'Google</span>'
        + (cuando ? '<span class="review-card__date">' + esc(cuando) + '</span>' : '')
        + '</div>'
        + '<p class="review-card__text">' + esc(r.comment) + '</p>'
        + '</li>';
    }).join("");

    // Nota media, estrellas y total de reseñas.
    var s = data.summary || {};
    if (s.average) {
      var score = document.querySelector("[data-gr-score]");
      if (score) score.textContent = String(s.average).replace(".", ",");
    }
    if (s.total) {
      var count = document.querySelector("[data-gr-count]");
      if (count) count.textContent = s.total;
    }
    if (s.stars) {
      var st = document.querySelector("[data-gr-stars]");
      if (st) st.textContent = "★★★★★".slice(0, s.stars) + "☆☆☆☆☆".slice(0, 5 - s.stars);
    }

    // Aviso cuando se muestran reseñas guardadas sin conexión.
    var status = document.querySelector("[data-gr-status]");
    if (status) {
      if (data.stale) {
        status.hidden = false;
        status.textContent = "Sin conexión con Google en este momento: te mostramos las últimas reseñas guardadas.";
      } else {
        status.hidden = true;
        status.textContent = "";
      }
    }
  }

  /* ==========================================================================
     9.d RESEÑAS DE TRUSTPILOT EN VIVO
     --------------------------------------------------------------------------
     Igual que con Google, pero para la ficha pública de Trustpilot. El backend
     (?resource=trustpilot) descarga la nota media y las reseñas y las cachea 6
     horas en la base de datos. Si no hay ficha configurada o falla la conexión,
     se mantienen las reseñas de ejemplo escritas en el HTML.
     ========================================================================== */
  function cargarTrustpilot() {
    var lista = document.querySelector("[data-tp-list]");
    if (!lista || !window.fetch) return;

    fetch(API_BASE + "index?resource=trustpilot", { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.ok || !data.items || !data.items.length) return;
        pintarTrustpilot(data);
      })
      .catch(function () { /* sin backend: se quedan las reseñas del HTML */ });
  }

  function pintarTrustpilot(data) {
    var lista = document.querySelector("[data-tp-list]");
    if (!lista) return;

    lista.innerHTML = data.items.slice(0, 3).map(function (r) {
      var n = Math.max(0, Math.min(5, parseInt(r.rating, 10) || 0));
      var stars = "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
      var cuando = r.relative_time || formatearFecha(r.created_at);
      return '<li class="review-card review-card--tp">'
        + '<div class="review-card__head">'
        + '<span class="review-card__author">' + esc(r.author_name) + '</span>'
        + '<span class="stars stars--sm" aria-label="' + n + ' de 5 estrellas" title="' + n + '/5">' + stars + '</span>'
        + '</div>'
        + '<div class="review-card__meta">'
        + '<span class="review-card__source review-card__source--tp">' + ICONO_TRUSTPILOT + 'Trustpilot</span>'
        + (cuando ? '<span class="review-card__date">' + esc(cuando) + '</span>' : '')
        + '</div>'
        + '<p class="review-card__text">' + esc(r.comment) + '</p>'
        + '</li>';
    }).join("");

    var s = data.summary || {};
    var nota = s.average || s.trustscore;
    if (nota) {
      var score = document.querySelector("[data-tp-score]");
      if (score) score.textContent = String(nota).replace(".", ",");
    }
    if (s.total) {
      var count = document.querySelector("[data-tp-count]");
      if (count) count.textContent = s.total;
    }
    if (s.stars) {
      var st = document.querySelector("[data-tp-stars]");
      if (st) st.textContent = "★★★★★".slice(0, s.stars) + "☆☆☆☆☆".slice(0, 5 - s.stars);
    }

    var status = document.querySelector("[data-tp-status]");
    if (status) {
      if (data.cached) {
        status.hidden = false;
        status.textContent = "Mostrando las últimas reseñas guardadas de Trustpilot.";
      } else {
        status.hidden = true;
        status.textContent = "";
      }
    }
  }

  /* Convierte una fecha ISO en algo legible (p. ej. "marzo de 2025"). */
  function formatearFecha(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    try {
      return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    } catch (e) {
      return "";
    }
  }

  var ICONO_TRUSTPILOT = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">'
    + '<path fill="#fff" d="m12 2 3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z"/></svg>';

  var ICONO_GOOGLE = '<svg viewBox="0 0 48 48" width="14" height="14" aria-hidden="true" focusable="false">'
    + '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>'
    + '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>'
    + '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>'
    + '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
})();
