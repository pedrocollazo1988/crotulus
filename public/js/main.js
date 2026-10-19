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

  // Endpoint de aportaciones (testimonios y preguntas abiertas, sin cuenta).
  var FORM_ENDPOINT_SUBMISSIONS = withBackend("api/submissions.php");

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
    setupTestimonialForm();    // formulario publico de testimonios (sin cuenta)
    setupGoogleReviewsLink();  // enlace «Ver todas en Google» (configurable)
    setupTrustpilotLink();     // enlace «Ver todas en Trustpilot» (configurable)
    setupSiteSearch();         // buscador global (secciones y contenido)
    setupLangSwitch();         // selector de idioma (es / en / pt)
    setupTheme();              // modo noche / dia
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
    return parseInt(m[3], 10) + " " + t(MESES[mes] || "") + " " + m[1];
  }

  function itemPost(it) {
    var img = it.image ? it.image : "assets/img/blog/web-que-convierte.jpg";
    var fecha = fechaCorta(it.published_at);
    var meta = [];
    if (it.author) meta.push(esc(it.author));
    if (fecha) meta.push('<time datetime="' + esc(String(it.published_at).slice(0, 10)) + '">' + fecha + "</time>");
    if (it.reading_minutes) meta.push(it.reading_minutes + " " + t("min"));
    return '<article class="post">'
      + '<a class="post__media" href="#blog" aria-label="' + esc(t("Leer:")) + " " + esc(t(it.title)) + '">'
      + fotoResponsive(img, t(it.title), 800, 500) + '</a>'
      + '<div class="post__body">'
      + (it.category ? '<span class="post__tag">' + esc(t(it.category)) + "</span>" : "")
      + '<h3 class="post__title"><a href="#blog">' + esc(t(it.title)) + "</a></h3>"
      + '<p class="post__text">' + esc(t(it.excerpt || it.body)) + "</p>"
      + '<p class="post__meta">' + meta.join(" &middot; ") + "</p>"
      + "</div></article>";
  }

  function itemMiembro(it) {
    var img = it.avatar ? esc(it.avatar) : "";
    var media = img
      ? '<div class="team-card__media"><img src="' + img + '" alt="' + esc(t("Retrato de")) + " " + esc(it.name) + '" width="400" height="400" loading="lazy" decoding="async"></div>'
      : "";
    return '<article class="team-card">' + media
      + '<div class="team-card__body">'
      + '<h3 class="team-card__name">' + esc(it.name) + "</h3>"
      + '<p class="team-card__role">' + esc(t(it.role)) + "</p>"
      + '<p class="team-card__bio">' + esc(t(it.bio)) + "</p>"
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
      + '<h3 class="card__title">' + esc(t(it.title)) + '</h3>'
      + '<p class="card__text">' + esc(t(it.body || it.subtitle)) + '</p>'
      + '<a class="card__link" href="#contacto" data-service="' + esc(it.title) + '">' + esc(t("Saber más"))
      + ' <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg></a></article>';
  }
  function itemProyecto(it) {
    var meta = it.meta || {};
    var img  = meta.image ? meta.image : "assets/img/proyecto-web.jpg";
    var resultado = meta.resultado ? '<p class="project__result">' + esc(t(meta.resultado)) + '</p>' : '';
    return '<article class="project"><div class="project__media">' + fotoResponsive(img, t(it.title), 800, 500) + '</div>'
      + '<div class="project__body"><span class="project__tag">' + esc(t(it.subtitle)) + '</span>'
      + '<h3 class="project__title">' + esc(t(it.title)) + '</h3>'
      + '<p class="project__text">' + esc(t(it.body)) + '</p>'
      + resultado
      + '<a class="project__link" href="#contacto">' + esc(t("Ver caso")) + ' &rarr;</a></div></article>';
  }
  /* Etiqueta de valoración reutilizable (estrellas + aria en el idioma activo). */
  function ratingHTML(estrellas, clase) {
    return '<span class="' + (clase || "testimonial__rating") + '" role="img" aria-label="'
      + esc(t("Valoración:")) + " " + estrellas + " " + esc(t("de 5 estrellas")) + '">'
      + new Array(estrellas + 1).join('<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="m12 2 3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z"/></svg>')
      + '</span>';
  }
  function itemTestimonio(it) {
    var meta = it.meta || {};
    var avatar = meta.photo
      ? fotoResponsive(meta.photo, t("Foto de") + " " + it.title, 96, 96, "testimonial__avatar")
      : '<span class="testimonial__avatar" aria-hidden="true">' + iniciales(it.title) + '</span>';
    var estrellas = meta.rating ? Math.max(1, Math.min(5, parseInt(meta.rating, 10) || 5)) : 5;
    var rating = ratingHTML(estrellas);
    var badge = '<span class="testimonial__badge">'
      + '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m5 12 5 5L20 6"/></svg>'
      + esc(t("Cliente verificado")) + '</span>';
    var resultado = meta.resultado
      ? '<p class="testimonial__result">' + esc(t(meta.resultado)) + '</p>' : '';
    return '<li class="testimonial"><blockquote class="testimonial__quote">'
      + '<div class="testimonial__top">' + rating + badge + '</div>'
      + '<p class="testimonial__text">&laquo;' + esc(t(it.body)) + '&raquo;</p>'
      + resultado
      + '</blockquote>'
      + '<footer class="testimonial__author">' + avatar
      + '<cite><strong>' + esc(it.title) + '</strong><span>' + esc(t(it.subtitle || meta.cargo || "")) + '</span></cite></footer></li>';
  }
  function itemFaq(it) {
    var id = "faq-" + esc(it.id);
    return '<div class="accordion__item"><h3 class="accordion__heading">'
      + '<button class="accordion__trigger" type="button" aria-expanded="false" aria-controls="' + id + '">' + esc(t(it.title))
      + '<span class="accordion__icon" aria-hidden="true"></span></button></h3>'
      + '<div class="accordion__panel" id="' + id + '" role="region"><p>' + esc(t(it.body)) + '</p></div></div>';
  }
  function itemProceso(it, idx) {
    return '<li class="step"><span class="step__num" aria-hidden="true">' + (idx + 1) + '</span>'
      + '<h3 class="step__title">' + esc(t(it.title)) + '</h3>'
      + '<p class="step__text">' + esc(t(it.body || it.subtitle)) + '</p></li>';
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
      if (s[key] !== undefined && String(s[key]).trim() !== "") el.textContent = t(s[key]);
    });
    if (direccion) {
      $$("[data-site-direccion]").forEach(function (el) { el.textContent = t(direccion); });
    }

    // Titular del hero: texto + palabra destacada con degradado
    $$("[data-site-title]").forEach(function (el) {
      var texto = s[el.getAttribute("data-site-title")];
      if (texto === undefined || String(texto).trim() === "") return;
      texto = t(texto);
      var accent = t(s[el.getAttribute("data-site-accent")] || "");
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
        if (lab) lab.textContent = t(lbl);
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
      if (alt !== undefined && String(alt).trim() !== "") img.setAttribute("alt", t(alt));
    });

    // Enlaces legales del pie: texto plano separado por «·», cada uno a contacto
    $$("[data-footer-legal]").forEach(function (el) {
      var texto = s.footer_legal;
      if (texto === undefined || String(texto).trim() === "") return;
      el.textContent = "";
      String(texto).split("·").forEach(function (parte, i) {
        var etiqueta = t(parte.trim());
        if (etiqueta === "") return;
        if (i > 0) el.appendChild(document.createTextNode(" · "));
        var a = document.createElement("a");
        a.href = "#contacto";
        a.textContent = etiqueta;
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
        // El iframe se inyecta al aplicar los ajustes (puede ser despues de
        // aplicarIdiomaDOM), por eso su title se traduce aqui directamente.
        cont.innerHTML = '<iframe src="' + esc(s.mapa_embed) + '" width="100%" height="360" style="border:0" '
          + 'loading="lazy" title="' + esc(t("Mapa con la ubicación de C-ROTULUS S.U.R.L. en Artemisa")) + '" '
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
     "trustpilot_enabled" ("1"/"0"). Si una vale "0" se oculta su sección (la que
     lleve data-section-toggle con esa clave) y TODOS los enlaces que apunten a su
     ancla (menú y pie), también desde empresa.html. Si la clave no llega (backend
     sin respuesta) todo se queda visible.
     ========================================================================== */
  var SECCIONES_TOGGLE = [
    { key: "testimonials_enabled", id: "testimonios" },
    { key: "google_reviews_enabled", id: "valoraciones" },
    { key: "trustpilot_enabled", id: "trustpilot" },
    { key: "blog_enabled", id: "blog" }
  ];

  function aplicarSeccionesVisibles(s) {
    var huboCambio = false;
    SECCIONES_TOGGLE.forEach(function (def) {
      var valor = s[def.key];
      if (valor === undefined) return;               // sin dato: no tocar
      if (String(valor) === "0") {
        huboCambio = true;
        $$('[data-section-toggle="' + def.key + '"]').forEach(function (sec) { sec.hidden = true; });
        $$('a[href="#' + def.id + '"], a[href$="#' + def.id + '"]').forEach(function (a) {
          var li = a.closest("li");
          (li || a).hidden = true;
        });
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
    // Metadato traducible: guarda el original en espanol y aplica el idioma
    // activo, para que el panel pueda cambiarlo sin perder la traduccion.
    function setMetaI18n(sel, value) {
      if (!value) return;
      var el = document.querySelector(sel);
      if (!el) return;
      el.setAttribute("data-i18n-content-es", value);
      var idioma = idiomaActivo();
      el.setAttribute("content", idioma === "es" ? value : (t(value) || value));
    }
    var name = s.site_name || "";
    if (name) {
      setMeta('meta[data-seo-name]', "content", name);
      // El titulo generico es el de la portada; empresa.html tiene el suyo.
      if (document.documentElement.getAttribute("data-page") !== "empresa") {
        TITULO_ES = name + " | Servicios tecnológicos para empresas";
        aplicarTitulo();
      }
    }
    if (s.meta_description) {
      // El ajuste del panel describe la portada; empresa.html tiene su propia
      // descripcion y no debe quedar pisada por la generica.
      if (document.documentElement.getAttribute("data-page") !== "empresa") {
        setMetaI18n('meta[data-seo-desc]', s.meta_description);
        setMetaI18n('meta[data-seo-ogdesc]', s.meta_description);
      }
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
    bar.innerHTML = '<strong>' + t("Modo mantenimiento:") + "</strong> " + t(mensaje);
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
          // Se deja el texto en español y se deja traducir al árbol del DOM:
          // así el enlace sigue el idioma activo también en cambios posteriores.
          navLink.textContent = loggedIn ? "Mi cuenta" : "Acceder";
          navLink.setAttribute("href", loggedIn ? ACCOUNT_URL : LOGIN_URL);
          aplicarIdiomaDOM();
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

  // Añade los testimonios aprobados de usuarios a la lista del carrusel y
  // ajusta la visibilidad del formulario publico segun el panel.
  function cargarTestimoniosUsuarios(forzar) {
    if (!window.fetch) return;
    fetch(API_BASE + "index?resource=testimonials", { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.ok) return;

        // Formulario publico: visible salvo que el panel lo desactive.
        aplicarFormularioTestimonios(data.form_enabled);

        var track = document.querySelector(".testimonials__track");
        if (!track || !data.items || !data.items.length) return;
        $$("[data-user-testimonial]", track).forEach(function (li) { li.remove(); });
        var html = data.items.map(function (it) {
          var avatar = it.photo
            ? fotoResponsive(it.photo, t("Foto de") + " " + it.author_name, 96, 96, "testimonial__avatar")
            : '<span class="testimonial__avatar" aria-hidden="true">' + iniciales(it.author_name) + '</span>';
          var estrellas = Math.max(1, Math.min(5, parseInt(it.rating, 10) || 5));
          var rating = ratingHTML(estrellas);
          var rol = it.role ? '<span>' + esc(it.role) + '</span>' : '<span>' + esc(t("Cliente")) + '</span>';
          return '<li class="testimonial" data-user-testimonial><blockquote class="testimonial__quote">'
            + '<div class="testimonial__top">' + rating + '</div>'
            + '<p class="testimonial__text">&laquo;' + esc(it.comment) + '&raquo;</p>'
            + '</blockquote><footer class="testimonial__author">' + avatar
            + '<cite><strong>' + esc(it.author_name) + '</strong>' + rol + '</cite></footer></li>';
        }).join("");
        track.insertAdjacentHTML("beforeend", html);
        if (typeof setupCarousel === "function") setupCarousel();
      })
      .catch(function () { /* sin testimonios de usuarios */ });
  }

  // Muestra u oculta la invitacion a dejar testimonio (y su enlace de cabecera)
  // segun el ajuste "testimonials_form_enabled" del panel.
  function aplicarFormularioTestimonios(habilitado) {
    if (habilitado === undefined || habilitado === null) return;   // sin dato: se deja como esta
    // La API puede devolver boolean (false) o cadena ("0"): se aceptan ambos.
    var visible = !(habilitado === false || String(habilitado) === "0");
    var invite = $("[data-testimonial-invite]");
    var cta = $("[data-testimonial-cta]");
    if (invite) invite.hidden = !visible;
    if (cta) {
      var li = cta.closest("li");
      (li || cta).hidden = !visible;
    }
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
      toggle.setAttribute("aria-label", t("Abrir menú de navegación"));
    }
    function open() {
      nav.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", t("Cerrar menú de navegación"));
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

  /* Anima una cifra hasta el valor de data-count. El sufijo final se toma de
     data-suffix ("+" por defecto; p. ej. "%" en la cifra de satisfaccion).
     Se usa al entrar en pantalla y también al aplicar valores de la BD. */
  function animarStat(el) {
    var target = parseInt(el.getAttribute("data-count"), 10) || 0;
    var suffix = el.hasAttribute("data-suffix") ? el.getAttribute("data-suffix") : "+";
    if (prefersReduced) { el.textContent = target + suffix; return; }
    var duration = 1200, start = null;
    requestAnimationFrame(function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      el.textContent = Math.floor(p * target) + (p === 1 ? suffix : "");
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
      b.setAttribute("aria-label", t("Ir al testimonio") + " " + (i + 1));
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
    cargarCaptcha(form);

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
        if (box) box.textContent = t(msg);
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
    if (refresh) refresh.addEventListener("click", function () { cargarCaptcha(form); });

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
        status.textContent = t("Revisa los campos marcados en rojo.");
        status.className = "form-status is-error";
        primero && primero.focus();
        return;
      }

      // Anti-spam: si el campo trampa tiene valor, simulamos exito y no enviamos.
      if (form.querySelector('[name="_gotcha"]').value !== "") {
        status.textContent = t("Mensaje enviado. Gracias.");
        status.className = "form-status is-success";
        form.reset();
        return;
      }

      // Envío al endpoint (backend propio o servicio externo compatible)
      status.textContent = t("Enviando...");
      status.className = "form-status";

      // Si es un servicio externo sin configurar, avisamos en vez de fallar en silencio.
      if (FORM_ENDPOINT.indexOf("TU_ID") !== -1) {
        status.textContent = t("Formulario no configurado: sustituye TU_ID en js/main.js y en el action del formulario.");
        status.className = "form-status is-error";
        return;
      }

      enviarFormulario(form, status);
    });
  }

  /* Pide un reto anti-spam a la API y lo pinta en el formulario.
     El reto y su firma los genera el servidor (no se puede falsificar).
     `scope` limita la busqueda a un formulario concreto (hay varios en la
     pagina: contacto y testimonios). */
  function cargarCaptcha(scope) {
    var q = $(".captcha__question", scope);
    var token = $('input[name="captcha_token"]', scope);
    var campo = $('input[name="captcha"]', scope);
    if (!q || !token) return;

    q.textContent = t("Cargando reto…");
    fetch(API_BASE + "index?action=captcha", { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok && d.challenge) {
          q.textContent = d.challenge;
          token.value = d.token || "";
          if (campo) campo.value = "";
        } else {
          q.textContent = t("Verificacion no disponible");
        }
      })
      .catch(function () { q.textContent = t("Verificacion no disponible"); });
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
          status.textContent = t("Gracias, hemos recibido tu mensaje. Te responderemos en menos de 24 horas laborables.");
          status.className = "form-status is-success";
          form.reset();
          cargarCaptcha(form);
          return;
        }
        // Errores por campo devueltos por el backend
        if (data && data.fields) {
          Object.keys(data.fields).forEach(function (name) {
            var el = form.querySelector('[name="' + name + '"]');
            if (el) setFieldError(form, el, data.fields[name]);
          });
        }
        status.textContent = t((data && data.error) || "No se pudo enviar. Inténtalo de nuevo o escríbenos por WhatsApp.");
        status.className = "form-status is-error";
        cargarCaptcha(form);
      })
      .catch(function () {
        status.textContent = t("No se pudo enviar. Inténtalo de nuevo o escríbenos por WhatsApp.");
        status.className = "form-status is-error";
        cargarCaptcha(form);
      });
  }

  /* Pide un token CSRF a la API (lo guarda en la sesión del servidor). */
  function obtenerCsrf() {
    return fetch(API_BASE + "index?action=csrf", { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (d) { return (d && d.csrf_token) || ""; })
      .catch(function () { return ""; });
  }

  /* ==========================================================================
     8.b FORMULARIO PÚBLICO DE TESTIMONIOS (abierto, sin cuenta)
     --------------------------------------------------------------------------
     Cualquier visitante puede dejar su testimonio desde la portada. Se envía a
     api/submissions.php (con CSRF y captcha) y entra como aportación: se
     modera en el panel · Aportaciones y, al aprobarse, aparece en el carrusel.
     ========================================================================== */

  /* --------------------------------------------------------------------------
     Selector de foto del testimonio: recorta en cuadrado y comprime en el
     navegador (canvas -> JPEG ~256px) para no subir archivos grandes ni
     depender de almacenamiento externo. El data URL va en el campo oculto.
     -------------------------------------------------------------------------- */
  function setupPhotoPicker(form) {
    var file = $("#tfFoto", form);
    var dataInput = $("#tfPhotoData", form);
    var preview = $("#tfPhotoPreview", form);
    var clearBtn = $("#tfPhotoClear", form);
    var hint = $("#tfPhotoHint", form);
    if (!file || !dataInput || !preview) return;

    var MAX_EDGE = 256, MAX_BYTES = 400000;

    function aviso(msg, error) {
      if (!hint) return;
      hint.textContent = msg;
      hint.classList.toggle("is-error", !!error);
    }

    function pintar(src) {
      if (!src) {
        preview.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M4 7h3l1.5-2h7L17 7h3v12H4z"/><circle cx="12" cy="13" r="3.2"/></svg>';
        preview.classList.remove("has-photo");
        if (clearBtn) clearBtn.hidden = true;
        return;
      }
      preview.innerHTML = '<img alt="" src="' + src + '">';
      preview.classList.add("has-photo");
      if (clearBtn) clearBtn.hidden = false;
    }

    function procesar(archivo) {
      if (!archivo) return;
      if (!/^image\/(jpeg|png|webp)$/i.test(archivo.type)) {
        aviso(t("Formato no válido. Usa JPG, PNG o WebP."), true);
        return;
      }
      aviso(t("Procesando la imagen…"), false);
      // FileReader (data URL) en vez de createObjectURL: la CSP del sitio
      // (img-src 'self' data: https:) no permite blob:.
      var lector = new FileReader();
      lector.onload = function () {
        var img = new Image();
        img.onload = function () {
          var lado = Math.min(img.naturalWidth, img.naturalHeight);
          var sx = Math.round((img.naturalWidth - lado) / 2);
          var sy = Math.round((img.naturalHeight - lado) / 2);
          var salida = Math.min(MAX_EDGE, lado) || MAX_EDGE;
          var canvas = document.createElement("canvas");
          canvas.width = canvas.height = salida;
          canvas.getContext("2d").drawImage(img, sx, sy, lado, lado, 0, 0, salida, salida);
          var data = canvas.toDataURL("image/jpeg", 0.82);
          if (data.length > MAX_BYTES) {
            dataInput.value = "";
            pintar("");
            aviso(t("La imagen es demasiado grande. Prueba con otra más ligera."), true);
            return;
          }
          dataInput.value = data;
          pintar(data);
          aviso(t("Foto lista. Se publicará junto a tu testimonio."), false);
        };
        img.onerror = function () {
          dataInput.value = "";
          pintar("");
          aviso(t("No se pudo leer la imagen. Prueba con otra."), true);
        };
        img.src = String(lector.result);
      };
      lector.onerror = function () {
        dataInput.value = "";
        pintar("");
        aviso(t("No se pudo leer la imagen. Prueba con otra."), true);
      };
      lector.readAsDataURL(archivo);
    }

    file.addEventListener("change", function () { procesar(file.files && file.files[0]); });
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        file.value = "";
        dataInput.value = "";
        pintar("");
        aviso(t("JPG, PNG o WebP. Se recorta en cuadrado y se optimiza antes de enviarse."), false);
      });
    }
    pintar(dataInput.value);
  }

  /* Vacía el selector de foto (tras enviar o al pulsar "Quitar"). */
  function limpiarFoto(form) {
    var file = $("#tfFoto", form);
    var dataInput = $("#tfPhotoData", form);
    var preview = $("#tfPhotoPreview", form);
    var clearBtn = $("#tfPhotoClear", form);
    var hint = $("#tfPhotoHint", form);
    if (file) file.value = "";
    if (dataInput) dataInput.value = "";
    if (preview) {
      preview.classList.remove("has-photo");
      preview.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M4 7h3l1.5-2h7L17 7h3v12H4z"/><circle cx="12" cy="13" r="3.2"/></svg>';
    }
    if (clearBtn) clearBtn.hidden = true;
    if (hint) {
      hint.textContent = t("JPG, PNG o WebP. Se recorta en cuadrado y se optimiza antes de enviarse.");
      hint.classList.remove("is-error");
    }
  }

  function setupTestimonialForm() {
    var form = $("#testimonialFormEl");
    if (!form) return;

    var status = $("#tfStatus");
    var ratingBox = $("#tfRating");
    var ratingInput = $("#tfRatingInput");
    var ratingValue = $("#tfRatingValue");
    var counter = $("#tfCounter");
    var texto = $("#tfTexto");

    // --- Selector de estrellas (accesible) ---
    function pintarEstrellas(valor) {
      $$(".rating-input__star", ratingBox).forEach(function (b) {
        var n = parseInt(b.getAttribute("data-rating"), 10);
        var on = n <= valor;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-checked", n === valor ? "true" : "false");
        b.setAttribute("tabindex", n === valor ? "0" : "-1");
      });
      ratingInput.value = valor;
      if (ratingValue) ratingValue.textContent = valor + " " + t("de 5");
    }
    if (ratingBox) {
      pintarEstrellas(5);
      $$(".rating-input__star", ratingBox).forEach(function (b) {
        b.addEventListener("click", function () {
          pintarEstrellas(parseInt(b.getAttribute("data-rating"), 10));
        });
        // Navegación con flechas dentro del grupo de radios
        b.addEventListener("keydown", function (ev) {
          var actual = parseInt(ratingInput.value, 10) || 5;
          if (ev.key === "ArrowRight" || ev.key === "ArrowUp") {
            ev.preventDefault(); pintarEstrellas(Math.min(5, actual + 1));
          } else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") {
            ev.preventDefault(); pintarEstrellas(Math.max(1, actual - 1));
          }
        });
      });
    }

    // --- Contador de caracteres ---
    if (texto && counter) {
      var max = parseInt(texto.getAttribute("maxlength"), 10) || 1500;
      var refrescar = function () { counter.textContent = texto.value.length + " / " + max; };
      texto.addEventListener("input", refrescar);
      refrescar();
    }

    cargarCaptcha(form);
    var refresh = $("#tfCaptchaRefresh");
    if (refresh) refresh.addEventListener("click", function () { cargarCaptcha(form); });

    setupPhotoPicker(form);

    // Reglas de validación por campo (mismas que el formulario de contacto)
    var reglas = {
      titulo:  { req: true, min: 2, msg: "Escribe tu nombre (mín. 2 caracteres)." },
      texto:   { req: true, min: 10, msg: "Cuéntanos un poco más (mín. 10 caracteres)." },
      captcha: { req: true, num: true, msg: "Resuelve la operacion de seguridad." }
    };

    function setError(input, msg) {
      var box = $('[data-error-for="' + input.id + '"]', form);
      if (msg) {
        input.setAttribute("aria-invalid", "true");
        if (box) box.textContent = t(msg);
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
      if (r.num && !/^-?\d+$/.test(v)) return setError(input, r.msg);
      if (r.min && v.length < r.min) return setError(input, r.msg);
      return setError(input, "");
    }

    $$("input, textarea", form).forEach(function (el) {
      if (!reglas[el.name]) return;
      el.addEventListener("blur", function () { validar(el); });
      el.addEventListener("input", function () {
        if (el.getAttribute("aria-invalid") === "true") validar(el);
      });
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();

      var campos = $$("input, textarea", form).filter(function (el) { return reglas[el.name]; });
      var ok = true, primero = null;
      campos.forEach(function (el) {
        if (!validar(el)) { ok = false; if (!primero) primero = el; }
      });
      if (!ok) {
        status.textContent = t("Revisa los campos marcados en rojo.");
        status.className = "form-status is-error";
        primero && primero.focus();
        return;
      }

      // Campo trampa: si un bot lo rellena, simulamos éxito y no enviamos.
      if ($('[name="_gotcha"]', form).value !== "") {
        status.textContent = t("¡Gracias! Tu testimonio se revisará antes de publicarse.");
        status.className = "form-status is-success";
        form.reset();
        pintarEstrellas(5);
        if (counter) counter.textContent = "0 / 1500";
        return;
      }

      status.textContent = t("Enviando…");
      status.className = "form-status";

      var datos = new FormData(form);
      obtenerCsrf()
        .then(function (token) {
          return fetch(FORM_ENDPOINT_SUBMISSIONS, {
            method: "POST",
            headers: { "Accept": "application/json", "X-CSRF-Token": token || "" },
            body: datos
          });
        })
        .then(function (res) { return res.json().catch(function () { return { ok: res.ok }; }); })
        .then(function (data) {
          if (data && data.ok) {
            status.textContent = t(data.message || "¡Gracias! Tu testimonio se revisará antes de publicarse.");
            status.className = "form-status is-success";
            form.reset();
            pintarEstrellas(5);
            if (counter) counter.textContent = "0 / 1500";
            limpiarFoto(form);
            cargarCaptcha(form);
            // Si se aprobó automáticamente, se muestra en el carrusel al momento.
            if (data.status === "aprobada") cargarTestimoniosUsuarios(true);
            return;
          }
          if (data && data.fields) {
            Object.keys(data.fields).forEach(function (name) {
              var el = form.querySelector('[name="' + name + '"]');
              if (el) setFieldError(form, el, data.fields[name]);
            });
          }
          status.textContent = t((data && data.error) || "No se pudo enviar. Inténtalo de nuevo en unos minutos.");
          status.className = "form-status is-error";
          cargarCaptcha(form);
        })
        .catch(function () {
          status.textContent = t("No se pudo enviar. Inténtalo de nuevo en unos minutos.");
          status.className = "form-status is-error";
          cargarCaptcha(form);
        });
    });
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
     8. BUSCADOR GLOBAL, IDIOMA Y TEMA
     --------------------------------------------------------------------------
     Tres herramientas de la cabecera:
     - Buscador: indexa en caliente las secciones de la página y sus elementos
       (servicios, proyectos, artículos, pasos, FAQ...) y lleva al resultado.
     - Idioma: traduce los textos de navegación (es / en / pt) y lo recuerda.
     - Tema: alterna día/noche con la clase .theme-dark en <html>.
     ========================================================================== */

  /* ==========================================================================
     IDIOMA (es / en / pt)
     --------------------------------------------------------------------------
     El diccionario traduce TODO el texto visible del sitio: la interfaz
     (cabecera, botones, formularios, pie), los textos de ejemplo del HTML y los
     textos que llegan desde la base de datos (ajustes y contenido editable).

     La clave del diccionario es el propio texto en español. Así no hace falta
     marcar cada nodo a mano: se traduce el texto literal y también los atributos
     (aria-label, placeholder, alt, title). Lo que no tenga traducción se queda
     tal cual (por ejemplo, los nombres propios y los datos de contacto).

     El contenido editable de la BD se traduce por diccionario: al cambiar de
     idioma se vuelve a pintar (loadContent/loadBlog/loadTeam/aplicarAjustes),
     ya que cada render traduce el texto con t().
     ========================================================================== */
  var I18N = {
    es: {},
    en: {
      // --- Rediseno de referencia (base44) ---
      "Nosotros": "About us",
      "Innovación tecnológica en Artemisa": "Technology innovation in Artemisa",
      "Potenciamos tu infraestructura digital con tecnología que funciona": "We power your digital infrastructure with technology that works",
      "infraestructura digital": "digital infrastructure",
      "Soluciones informáticas, automatización con IA, redes y soporte para negocios en Cuba. Te acompañamos de la idea al resultado.": "IT solutions, AI automation, networks and support for businesses in Cuba. We accompany you from idea to result.",
      "Ver servicios": "View services",
      "Proyectos activos: 12 · Soporte en menos de 24 h": "Active projects: 12 · Support in under 24 h",
      "clientes activos": "active clients",
      "satisfacción": "satisfaction",
      "Un aliado tecnológico con base en Artemisa": "A technology partner based in Artemisa",
      "Confianza": "Trust",
      "Innovación": "Innovation",
      "Cercanía": "Closeness",
      "Eficiencia": "Efficiency",
      "Cumplimos lo que prometemos y cuidamos cada dato.": "We keep our promises and protect every piece of data.",
      "Adoptamos IA y nuevas tecnologías con criterio.": "We adopt AI and new technologies with judgement.",
      "Acompañamos a cada cliente como un socio.": "We support every client as a partner.",
      "Entregamos resultados medibles y a tiempo.": "We deliver measurable results on time.",
      "Soluciones completas para tu negocio": "Complete solutions for your business",
      "Desde la infraestructura hasta la inteligencia artificial: cubrimos todo el ciclo tecnológico.": "From infrastructure to artificial intelligence: we cover the entire technology cycle.",
      "Soporte y mantenimiento": "Support and maintenance",
      "Soporte técnico preventivo y correctivo con tiempos de respuesta rápidos.": "Preventive and corrective technical support with fast response times.",
      "Consultoría": "Consulting",
      "Diagnóstico tecnológico y hoja de ruta clara para tu transformación digital.": "Technology assessment and a clear roadmap for your digital transformation.",
      "Diseño e impresiones": "Design and printing",
      "Identidad visual, material gráfico e impresión de gran formato.": "Visual identity, graphic material and large-format printing.",
      "Instalación de redes": "Network installation",
      "Cableado estructurado, Wi-Fi de alto rendimiento y configuración segura.": "Structured cabling, high-performance Wi-Fi and secure configuration.",
      "Automatización con IA": "AI automation",
      "Automatiza tareas repetitivas y toma mejores decisiones con inteligencia artificial.": "Automate repetitive tasks and make better decisions with artificial intelligence.",
      "Soluciones informáticas": "IT solutions",
      "Sistemas a medida, punto de venta y gestión empresarial adaptados a tu operación.": "Custom systems, point of sale and business management tailored to your operation.",
      "Saber más": "Learn more",
      "Resultados que respaldan nuestra palabra": "Results that back our word",
      "Casos reales donde la tecnología marcó la diferencia.": "Real cases where technology made the difference.",
      "Telecomunicaciones": "Telecommunications",
      "Logística": "Logistics",
      "Red corporativa multi-sede": "Multi-site corporate network",
      "Cableado estructurado y Wi-Fi segmentado para una institución con tres sedes.": "Structured cabling and segmented Wi-Fi for an institution with three sites.",
      "Cobertura del 99% y conectividad segura entre sedes.": "99% coverage and secure connectivity between sites.",
      "Automatización de inventario con IA": "AI-driven inventory automation",
      "Predicción de demanda y reabastecimiento automático para un distribuidor regional.": "Demand forecasting and automatic replenishment for a regional distributor.",
      "Quiebres de stock reducidos en un 60% y rotación optimizada.": "Stockouts cut by 60% and optimised turnover.",
      "Modernización de punto de venta": "Point-of-sale modernisation",
      "Sistema integrado de ventas e inventario para una cadena de tiendas en Artemisa.": "Integrated sales and inventory system for a store chain in Artemisa.",
      "Reducción del 40% en errores de inventario y facturación 3× más rápida.": "40% fewer inventory errors and 3× faster billing.",
      "Un proceso claro, en cinco pasos": "A clear process, in five steps",
      "Entendemos tu negocio y detectamos oportunidades.": "We understand your business and spot opportunities.",
      "Diseñamos una solución clara con alcance y costo.": "We design a clear solution with scope and cost.",
      "Ejecutamos la solución con calidad y a tiempo.": "We deliver the solution with quality and on time.",
      "Capacitación": "Training",
      "Tu equipo domina la nueva tecnología.": "Your team masters the new technology.",
      "Acompañamiento continuo tras el lanzamiento.": "Ongoing support after launch.",
      "Gerente · Tienda La Artemiseña": "Manager · La Artemiseña Store",
      "C-ROTULUS transformó nuestra forma de vender. El sistema de punto de venta es rápido y el soporte siempre está disponible.": "C-ROTULUS transformed the way we sell. The point-of-sale system is fast and support is always available.",
      "Sistema de ventas 3× más rápido": "3× faster sales system",
      "Contáctenos": "Contact us",
      "Cuéntanos qué necesitas y te contactamos": "Tell us what you need and we will get in touch",
      "Responde en menos de 24 horas hábiles. Sin compromiso.": "We reply within 24 business hours. No obligation.",
      "Atienden negocios fuera de Artemisa": "Do you serve businesses outside Artemisa",
      "¿Atienden negocios fuera de Artemisa?": "Do you serve businesses outside Artemisa?",
      "Sí. Tenemos base en Artemisa pero acompañamos clientes en todo el occidente de Cuba. Para proyectos lejanos combinamos visitas con soporte remoto.": "Yes. We are based in Artemisa but support clients across western Cuba. For distant projects we combine visits with remote support.",
      "¿Cuánto tarda un proyecto típico?": "How long does a typical project take?",
      "Depende del alcance. Una instalación de red o punto de venta suele tomar de 1 a 3 semanas; proyectos con automatización de IA entre 4 y 8 semanas. Siempre entregamos un cronograma en la propuesta.": "It depends on the scope. A network or point-of-sale installation usually takes 1 to 3 weeks; AI automation projects take 4 to 8 weeks. We always provide a schedule in the proposal.",
      "¿Ofrecen soporte después de la entrega?": "Do you offer support after delivery?",
      "Sí. Todos los proyectos incluyen un periodo de garantía y ofrecemos planes de soporte preventivo y correctivo con tiempos de respuesta definidos.": "Yes. All projects include a warranty period and we offer preventive and corrective support plans with defined response times.",
      "¿Trabajan con equipos y software que ya tenemos?": "Do you work with the equipment and software we already have?",
      "En la mayoría de los casos, sí. Hacemos un diagnóstico inicial para aprovechar tu infraestructura existente y recomendamos cambios solo cuando aportan valor real.": "In most cases, yes. We run an initial assessment to make the most of your existing infrastructure and only recommend changes that add real value.",
      "¿Cómo solicito un presupuesto?": "How do I request a quote?",
      "Completa el formulario de contacto o escríbenos por WhatsApp. Te respondemos en menos de 24 horas hábiles con una primera propuesta.": "Fill in the contact form or message us on WhatsApp. We reply within 24 business hours with a first proposal.",
      "¿Sus soluciones funcionan sin conexión a Internet?": "Do your solutions work without an Internet connection?",
      "Diseñamos sistemas que operan en redes locales sin depender de Internet, ideal para entornos con conectividad limitada. La nube se usa solo cuando aporta ventajas.": "We design systems that run on local networks without relying on the Internet, ideal for environments with limited connectivity. The cloud is used only when it adds value.",
      "Desde 2017 acompañamos a pymes e instituciones cubanas a modernizar su infraestructura, automatizar procesos y tomar decisiones con datos.": "Since 2017 we have helped Cuban SMEs and institutions modernise their infrastructure, automate processes and make data-driven decisions.",

      // --- Navegación y cabecera ---
      "Inicio": "Home", "Empresa": "Company", "Servicios": "Services",
      "Proyectos": "Projects", "Proceso": "Process", "Testimonios": "Testimonials",
      "Sección": "Section", "Servicio": "Service", "Proyecto": "Project",
      "Opinión": "Review", "Testimonio": "Testimonial",
      "Acceder": "Sign in", "Mi cuenta": "My account", "Contacto": "Contact", "Opiniones": "Reviews",
      "Blog": "Blog", "Ubicación": "Location", "Preguntas frecuentes": "FAQ",
      "Español": "Español", "English": "English", "Português": "Português",
      "Saltar al contenido principal": "Skip to main content",
      "Buscar en el sitio": "Search the site",
      "Idioma del sitio": "Site language",
      "Cambiar a modo noche": "Switch to dark mode",
      "Cambiar a modo día": "Switch to light mode",
      "Cerrar búsqueda": "Close search",
      "Abrir menú de navegación": "Open navigation menu",
      "Navegación principal": "Main navigation",
      "C-ROTULUS, ir al inicio": "C-ROTULUS, go to home",
      "Buscar en el sitio: servicios, proyectos, blog, preguntas…":
        "Search the site: services, projects, blog, questions…",
      "Sin resultados. Prueba con otra palabra.": "No results. Try another word.",
      "Enlaces rápidos": "Quick links", "Síguenos": "Follow us",
      "Ruta de navegación": "Breadcrumb", "Sitemap": "Sitemap",
      "Redes sociales de C-ROTULUS": "C-ROTULUS social media",
      "Volver arriba": "Back to top",

      // --- Hero ---
      "Agencia de servicios tecnológicos · Pymes y autónomos":
        "Technology services agency · SMEs and freelancers",
      "Tecnología clara que hace crecer tu negocio":
        "Clear technology that grows your business",
      "Ayudamos a pymes y autónomos a digitalizarse con desarrollo web, automatización e IA, redes seguras y soporte continuo. Menos problemas, más tiempo para lo que importa.":
        "We help SMEs and freelancers go digital with web development, automation and AI, secure networks and ongoing support. Fewer problems, more time for what matters.",
      "Solicitar servicios": "Request services",
      "Escríbenos por WhatsApp": "Message us on WhatsApp",
      "Descubre mas": "Discover more", "Descubre más": "Discover more",
      "Bajar a la seccion Servicios": "Go down to the Services section",
      "Cifras de confianza": "Key figures",
      "años de experiencia": "years of experience",
      "clientes satisfechos": "satisfied clients",
      "proyectos entregados": "projects delivered",
      "horas de respuesta": "hours response time",

      // --- Maqueta del agente IA (hero) ---
      "Agente IA · Facturas y firmas": "AI agent · Invoices and signatures",
      "en vivo": "live", "Entrada": "Input",
      "factura-2026-0412.pdf recibida por correo": "invoice-2026-0412.pdf received by email",
      "Lectura IA": "AI reading",
      "emisor, NIF, importe y fecha extraídos (OCR)": "issuer, VAT no., amount and date extracted (OCR)",
      "Validación": "Validation",
      "coincide con el pedido · sin duplicados": "matches the order · no duplicates",
      "Firma digital": "Digital signature",
      "sellada con certificado de la empresa": "sealed with the company certificate",
      "Firmado": "Signed", "4 pasos · 8 s · 0 errores": "4 steps · 8 s · 0 errors",
      "Agente de IA que recibe una factura, extrae los datos, valida, la firma digitalmente y la archiva automáticamente":
        "AI agent that receives an invoice, extracts the data, validates it, signs it digitally and files it automatically",

      // --- Cabeceras de sección ---
      "Sobre nosotros": "About us", "Equipo": "Team", "Cómo trabajamos": "How we work",
      "Reseñas verificadas": "Verified reviews",
      "Un equipo cercano con soluciones serias": "A close-knit team with serious solutions",
      "Las personas detrás de C-ROTULUS": "The people behind C-ROTULUS",
      "Todo lo que tu empresa necesita, en un solo equipo":
        "Everything your company needs, from one team",
      "Trabajos que ya están dando resultados": "Work that is already delivering results",
      "Ideas y consejos para tu negocio": "Ideas and tips for your business",
      "Un proceso simple, en cuatro pasos": "A simple process, in four steps",
      "Lo que opinan nuestros clientes": "What our clients say",
      "Lo que opinan de nosotros en Google": "What people say about us on Google",
      "Lo que dicen en Trustpilot": "What they say on Trustpilot",
      "Cuéntanos tu proyecto": "Tell us about your project",
      "Dónde estamos y cómo contactarnos": "Where we are and how to reach us",
      "Resolvemos tus dudas": "We answer your questions",
      "Servicios de ejemplo fáciles de editar. Cada tarjeta incluye icono, descripción, contenido y botón de consulta.":
        "Sample services, easy to edit. Each card includes an icon, description, content and a query button.",
      "Una muestra de proyectos de ejemplo. Sustituye las imágenes, los textos y las etiquetas por tus casos reales.":
        "A sample of example projects. Replace the images, texts and tags with your real cases.",
      "Publicamos guías sencillas sobre tecnología, seguridad y productividad. Sin tecnicismos innecesarios.":
        "We publish simple guides on technology, security and productivity. No unnecessary jargon.",
      "Sin sorpresas: te acompañamos desde la primera conversación hasta el soporte del día a día.":
        "No surprises: we support you from the first conversation to day-to-day support.",
      "Opiniones de clientes reales. Comparte la tuya en un minuto, sin crear ninguna cuenta.":
        "Reviews from real clients. Share yours in a minute, without creating an account.",
      "Reseñas reales de clientes publicadas en nuestra ficha de Google. Puedes leerlas todas en un clic.":
        "Real customer reviews published on our Google listing. Read them all in one click.",
      "Opiniones reales de clientes publicadas en nuestra ficha de Trustpilot.":
        "Real customer reviews published on our Trustpilot listing.",
      "Rellena el formulario y te respondemos en menos de 24 horas laborables.":
        "Fill in the form and we will reply within 24 working hours.",
      "Visítanos, llámanos o escríbenos. Estamos a tu disposición en horario de oficina.":
        "Visit us, call us or write to us. We are here during office hours.",
      "Mostramos las preguntas más relevantes, ordenadas automáticamente por su importancia.":
        "We show the most relevant questions, automatically sorted by importance.",
      "Desde [AÑO DE FUNDACIÓN] acompañamos a empresas en su transformación digital, combinando tecnología y trato humano.":
        "Since [FOUNDING YEAR] we have supported companies in their digital transformation, combining technology and a human touch.",
      "Un equipo pequeño, cercano y especializado. Estas son las personas que te atenderán y trabajarán en tu proyecto.":
        "A small, close-knit and specialised team. These are the people who will assist you and work on your project.",

      // --- Botones y textos comunes ---
      "Consultar": "Ask us", "Ver caso": "View case", "Deja tu testimonio": "Leave your review",
      "Ver todas en Google": "See all on Google",
      "Ver todas en Trustpilot": "See all on Trustpilot",
      "Basado en": "Based on", "reseñas": "reviews",
      "Enviar solicitud": "Send request",
      "Al enviar aceptas nuestra política de privacidad.":
        "By sending you accept our privacy policy.",
      "Inicia sesión para proponer una pregunta": "Sign in to suggest a question",
      "Cómo llegar en Google Maps": "Get directions on Google Maps",
      "C-ROTULUS S.U.R.L. Todos los derechos reservados.":
        "C-ROTULUS S.U.R.L. All rights reserved.",
      "Aviso legal · Privacidad · Cookies": "Legal notice · Privacy · Cookies",
      "Servicios tecnológicos para empresas. Desarrollo, automatización, redes y soporte con trato cercano.":
        "Technology services for businesses. Development, automation, networks and support with a close touch.",

      // --- Formularios ---
      "Tu experiencia ayuda a otros": "Your experience helps others",
      "Cuéntanos cómo fue trabajar con nosotros. Tu testimonio se publica en la portada y ayuda a otras empresas a decidirse. No necesitas cuenta.":
        "Tell us what it was like working with us. Your review is published on the homepage and helps other companies decide. No account needed.",
      "Se revisa antes de publicarse.": "It is reviewed before publishing.",
      "Puedes firmar con tu nombre y empresa.": "You can sign with your name and company.",
      "Tu correo no se muestra nunca.": "Your email is never shown.",
      "Tu nombre *": "Your name *",
      "Cargo y empresa": "Role and company", "(opcional)": "(optional)",
      "Tu valoración *": "Your rating *",
      "Tu foto": "Your photo", "Elegir imagen": "Choose image", "Quitar": "Remove",
      "JPG, PNG o WebP. Se recorta en cuadrado y se optimiza antes de enviarse.":
        "JPG, PNG or WebP. It is cropped to a square and optimised before sending.",
      "Tu experiencia *": "Your experience *",
      "Verificacion de seguridad *": "Security check *",
      "Verificación de seguridad *": "Security check *",
      "Cargando reto…": "Loading challenge…",
      "Resuelve la operacion para demostrar que eres una persona.":
        "Solve the operation to prove you are a person.",
      "Resuelve la operación para demostrar que eres una persona.":
        "Solve the operation to prove you are a person.",
      "No rellenar": "Do not fill in",
      "Publicar mi testimonio": "Publish my review",
      "Nombre y apellidos *": "Full name *",
      "Correo electrónico *": "Email *",
      "Teléfono *": "Phone *",
      "Servicio de interés *": "Service of interest *",
      "Selecciona un servicio": "Select a service",
      "Mensaje *": "Message *",
      "Otro": "Other",
      "Desarrollo web y aplicaciones": "Web development and applications",
      "Automatización y agentes de IA": "Automation and AI agents",
      "Soporte técnico": "Technical support",
      "Redes y ciberseguridad": "Networks and cybersecurity",
      "Consultoría tecnológica": "Technology consulting",
      "Mantenimiento integral": "Full maintenance",
      "Ej.: María Pérez": "E.g.: María Pérez",
      "Ej.: Gerente · Distribuciones ML": "E.g.: Manager · Distribuciones ML",
      "¿Qué problema tenías y cómo lo resolvimos?": "What problem did you have and how did we solve it?",
      "Generar otro reto de seguridad": "Generate another security challenge",
      "Testimonio anterior": "Previous review", "Testimonio siguiente": "Next review",
      "Seleccionar testimonio": "Select review",
      "Testimonios de clientes": "Customer reviews",
      "Valoración: 5 de 5 estrellas": "Rating: 5 out of 5 stars",
      "de 5": "out of 5",
      "Escribe tu nombre.": "Enter your name.",
      "Escribe un correo válido.": "Enter a valid email.",
      "Escribe un teléfono válido (mín. 9 dígitos).": "Enter a valid phone (min. 9 digits).",
      "Selecciona un servicio.": "Select a service.",
      "Cuéntanos un poco más (mín. 10 caracteres).": "Tell us a bit more (min. 10 characters).",
      "Escribe tu nombre (mín. 2 caracteres).": "Enter your name (min. 2 characters).",
      "Resuelve la operacion de seguridad.": "Solve the security operation.",
      "Resuelve la operación de seguridad.": "Solve the security operation.",
      "Revisa los campos marcados en rojo.": "Check the fields marked in red.",
      "Enviando...": "Sending…", "Enviando…": "Sending…",
      "Mensaje enviado. Gracias.": "Message sent. Thank you.",
      "Gracias, hemos recibido tu mensaje. Te responderemos en menos de 24 horas laborables.":
        "Thank you, we have received your message. We will reply within 24 working hours.",
      "¡Gracias! Tu testimonio se revisará antes de publicarse.":
        "Thank you! Your review will be checked before publishing.",
      "No se pudo enviar. Inténtalo de nuevo o escríbenos por WhatsApp.":
        "It could not be sent. Try again or message us on WhatsApp.",
      "No se pudo enviar. Inténtalo de nuevo en unos minutos.":
        "It could not be sent. Try again in a few minutes.",
      "Verificacion no disponible": "Verification unavailable",
      "Verificación no disponible": "Verification unavailable",
      "Sin conexión con Google en este momento: te mostramos las últimas reseñas guardadas.":
        "No connection to Google right now: we are showing the last saved reviews.",
      "Mostrando las últimas reseñas guardadas de Trustpilot.":
        "Showing the last saved Trustpilot reviews.",
      "Formato no válido. Usa JPG, PNG o WebP.": "Invalid format. Use JPG, PNG or WebP.",
      "Procesando la imagen…": "Processing the image…",
      "La imagen es demasiado grande. Prueba con otra más ligera.":
        "The image is too large. Try a lighter one.",
      "No se pudo leer la imagen. Prueba con otra.": "The image could not be read. Try another one.",
      "Foto lista. Se publicará junto a tu testimonio.":
        "Photo ready. It will be published with your review.",
      "Formulario no configurado: sustituye TU_ID en js/main.js y en el action del formulario.":
        "Form not configured: replace TU_ID in js/main.js and in the form action.",
      "Mapa con la ubicación de C-ROTULUS S.U.R.L. en Artemisa":
        "Map with the location of C-ROTULUS S.U.R.L. in Artemisa",

      // --- Empresa ---
      "Quiénes somos": "Who we are",
      "Somos C-ROTULUS S.U.R.L., una empresa de servicios tecnológicos. Conoce nuestra historia, lo que nos mueve y al equipo que estará a tu lado.":
        "We are C-ROTULUS S.U.R.L., a technology services company. Get to know our history, what drives us and the team that will be by your side.",
      "Nuestra historia": "Our story",
      "C-ROTULUS nació con una idea sencilla: la tecnología no debería ser un dolor de cabeza. Empezamos resolviendo pequeños problemas informáticos para negocios de nuestro entorno y, con el tiempo, ampliamos el servicio hasta diseñar, desplegar y mantener la infraestructura digital completa de nuestros clientes.":
        "C-ROTULUS was born from a simple idea: technology should not be a headache. We started by solving small IT problems for nearby businesses and, over time, expanded our service to design, deploy and maintain our clients' entire digital infrastructure.",
      "Hoy trabajamos con pymes y autónomos que necesitan soluciones claras, seguras y sin sorpresas: desde una web que convierte visitas en clientes hasta la automatización de tareas con inteligencia artificial o la protección de su red.":
        "Today we work with SMEs and freelancers who need clear, secure solutions with no surprises: from a website that turns visits into customers to task automation with artificial intelligence or protecting their network.",
      "Hoy trabajamos con pymes e instituciones que necesitan soluciones claras, seguras y sin sorpresas: desde la instalación de una red hasta la automatización de tareas con inteligencia artificial o la modernización de su punto de venta.":
        "Today we work with SMEs and institutions that need clear, secure solutions with no surprises: from setting up a network to automating tasks with artificial intelligence or modernising their point of sale.",
      "Nuestros valores": "Our values",
      "Cercanía y transparencia": "Closeness and transparency",
      "Compromiso con los plazos": "Commitment to deadlines",
      "Calidad y seguridad": "Quality and security",
      "Mejora continua": "Continuous improvement",
      "Misión": "Mission",
      "Aportar tecnología fiable y comprensible que permita a las empresas trabajar mejor, con más seguridad y menos costes ocultos.":
        "Provide reliable, understandable technology that lets companies work better, with more security and fewer hidden costs.",
      "Proveer soluciones informáticas confiables y accesibles que impulsen la productividad y la competitividad de los negocios en Cuba.":
        "Provide reliable, accessible IT solutions that boost the productivity and competitiveness of businesses in Cuba.",
      "Visión": "Vision",
      "Ser el socio tecnológico de referencia de las pymes de nuestro entorno, reconocidos por la cercanía y la calidad del servicio.":
        "To be the benchmark technology partner for SMEs in our area, known for our closeness and service quality.",
      "Ser el aliado tecnológico de referencia en el occidente del país, reconocido por nuestra calidad, cercanía y compromiso con los resultados.":
        "To be the benchmark technology partner in western Cuba, known for our quality, closeness and commitment to results.",
      "¿Hablamos de tu proyecto?": "Shall we talk about your project?",
      "Cuéntanos qué necesitas y te propondremos la mejor solución, sin compromiso.":
        "Tell us what you need and we will propose the best solution, with no obligation.",
      "Solicitar presupuesto": "Request a quote",

      // --- Contacto (datos) ---
      "Teléfonos": "Phones", "Correo": "Email", "Dirección": "Address", "Horario": "Hours",
      "Lunes a Viernes de 9:00 am a 5:00 pm": "Monday to Friday, 9:00 am to 5:00 pm",
      "Datos de contacto": "Contact details",

      // --- Contenido editable (BD) ---
      "Diseño y programación": "Design and programming",
      "Productividad": "Productivity", "Atención continua": "Ongoing support",
      "Infraestructura": "Infrastructure", "Estrategia": "Strategy",
      "Continuidad": "Continuity",
      "Webs corporativas, tiendas online y aplicaciones a medida rápidas y fáciles de gestionar.":
        "Corporate websites, online stores and custom applications that are fast and easy to manage.",
      "Automatizamos tareas repetitivas y creamos asistentes que atienden, filtran y organizan información.":
        "We automate repetitive tasks and build assistants that handle, filter and organise information.",
      "Atención rápida para tu equipo: incidencias, equipos y software resueltos sin perder tiempo.":
        "Fast support for your team: incidents, devices and software sorted without wasting time.",
      "Infraestructura de red estable y protegida, con copias de seguridad y planes de contingencia.":
        "A stable, protected network infrastructure, with backups and contingency plans.",
      "Analizamos qué necesitas de verdad y trazamos un plan realista, con presupuesto claro.":
        "We analyse what you really need and draw up a realistic plan, with a clear budget.",
      "Nos ocupamos de que todo siga funcionando: actualizaciones, monitorización y mejoras continuas.":
        "We make sure everything keeps running: updates, monitoring and continuous improvements.",
      "Diseño responsive": "Responsive design", "Panel autogestionable": "Self-managed panel",
      "SEO técnico incluido": "Technical SEO included",
      "Chatbots y asistentes": "Chatbots and assistants",
      "Integración entre herramientas": "Integration between tools",
      "Informes automáticos": "Automatic reports",
      "Helpdesk multicanal": "Multichannel helpdesk",
      "Soporte remoto y presencial": "Remote and on-site support",
      "Tiempos de respuesta acordados": "Agreed response times",
      "Wi-Fi y cableado profesional": "Professional Wi-Fi and cabling",
      "Firewall y antivirus gestionado": "Managed firewall and antivirus",
      "Copias de seguridad": "Backups",
      "Auditoría de sistemas": "Systems audit",
      "Plan de digitalización": "Digitalisation plan",
      "Optimización de costes": "Cost optimisation",
      "Monitorización 24/7": "24/7 monitoring",
      "Actualizaciones de seguridad": "Security updates",
      "Informe mensual": "Monthly report",
      "Desarrollo web": "Web development", "Automatización e IA": "Automation and AI",
      "Redes y seguridad": "Networks and security", "Automatización": "Automation",
      "Seguridad": "Security",
      "Tienda online para distribuidora local": "Online store for a local distributor",
      "Catálogo de más de 2.000 referencias, pago integrado y panel de gestión para el equipo.":
        "A catalogue of over 2,000 items, integrated payment and a management panel for the team.",
      "Asistente que atiende consultas 24/7": "Assistant that handles queries 24/7",
      "Un agente de IA que responde dudas frecuentes y deriva las incidencias al equipo humano.":
        "An AI agent that answers frequent questions and passes incidents to the human team.",
      "Renovación de red en oficinas": "Office network upgrade",
      "Cableado, Wi-Fi profesional y firewall gestionado para 60 puestos de trabajo.":
        "Cabling, professional Wi-Fi and a managed firewall for 60 workstations.",
      "Cómo la IA puede ahorrar horas a tu pyme": "How AI can save your SME hours",
      "Descubre qué tareas conviene automatizar primero y cómo empezar sin complicaciones.":
        "Find out which tasks are worth automating first and how to start without complications.",
      "Protege tu red: 5 medidas básicas": "Protect your network: 5 basic measures",
      "Cinco acciones sencillas que reducen drásticamente el riesgo de un incidente.":
        "Five simple actions that drastically reduce the risk of an incident.",
      "Una web que convierte visitas en clientes": "A website that turns visits into customers",
      "Qué debe tener tu web para que quien llega termine contactando contigo.":
        "What your website needs so that visitors end up contacting you.",
      "Diagnóstico": "Diagnosis", "Propuesta": "Proposal",
      "Implementación": "Implementation", "Soporte": "Support",
      "Escuchamos tus necesidades y analizamos el estado actual de tu tecnología.":
        "We listen to your needs and analyse the current state of your technology.",
      "Recibes una solución clara, con alcance, plazos y precio cerrado.":
        "You receive a clear solution, with scope, deadlines and a fixed price.",
      "Ejecutamos el proyecto con seguimiento y pruebas antes de la entrega.":
        "We run the project with monitoring and testing before delivery.",
      "Te acompañamos después: mantenimiento, mejoras y atención cuando lo necesites.":
        "We stay with you afterwards: maintenance, improvements and support whenever you need it.",
      "Nos renovaron la web y automatizaron los presupuestos. Ahora ahorramos varias horas cada semana y todo es mucho más claro.":
        "They revamped our website and automated our quotes. We now save several hours a week and everything is much clearer.",
      "En una semana teníamos la red y las copias de seguridad funcionando. El soporte responde siempre rápido.":
        "Within a week our network and backups were up and running. Support always responds quickly.",
      "Un asistente de IA atiende nuestras consultas fuera de horario. Ha mejorado la atención al cliente notablemente.":
        "An AI assistant handles our queries outside office hours. Customer service has improved noticeably.",
      "Gerente · Distribuciones ML": "Manager · Distribuciones ML",
      "Director · Talleres Ruiz": "Director · Talleres Ruiz",
      "Fundadora · CliniSalud": "Founder · CliniSalud",
      "de solicitudes online en 3 meses": "more online requests in 3 months",
      "+40% de solicitudes online en 3 meses": "+40% more online enquiries in 3 months",
      "0 incidencias críticas en 12 meses": "0 critical incidents in 12 months",
      "70% de consultas resueltas sin espera": "70% of queries resolved with no wait",
      "críticas en 12 meses": "critical incidents in 12 months",
      "de consultas resueltas sin espera": "of queries resolved without waiting",
      "¿Cuánto cuesta un proyecto?": "How much does a project cost?",
      "Depende del alcance. Tras el diagnóstico gratuito te entregamos un presupuesto cerrado y sin compromiso, con todo detallado.":
        "It depends on the scope. After the free diagnosis we give you a fixed, no-obligation quote, fully itemised.",
      "¿Cuánto tardáis en entregar?": "How long do you take to deliver?",
      "Una web corporativa suele estar en 2-4 semanas. Los proyectos de automatización o redes dependen del alcance; acordamos plazos antes de empezar.":
        "A corporate website usually takes 2-4 weeks. Automation or network projects depend on the scope; we agree deadlines before starting.",
      "¿Ofrecéis garantía?": "Do you offer a warranty?",
      "Sí. Todo trabajo incluye garantía sobre lo entregado y, opcionalmente, un plan de mantenimiento para mantenerlo actualizado y seguro.":
        "Yes. All work includes a warranty on what is delivered and, optionally, a maintenance plan to keep it updated and secure.",
      "¿Qué incluye el soporte?": "What does support include?",
      "Atención por teléfono, correo o WhatsApp, resolución de incidencias, actualizaciones de seguridad y asesoramiento según el plan contratado.":
        "Support by phone, email or WhatsApp, incident resolution, security updates and advice according to the plan you choose.",
      "¿Cómo puedo pagar?": "How can I pay?",
      "Aceptamos transferencia bancaria y pago con tarjeta. En proyectos grandes, un anticipo al empezar y el resto a la entrega.":
        "We accept bank transfer and card payment. On large projects, a deposit at the start and the rest on delivery.",
      "¿Cómo empiezo?": "How do I start?",
      "Escríbenos por el formulario o WhatsApp. Concertamos una llamada o reunión sin coste y te proponemos los siguientes pasos.":
        "Write to us via the form or WhatsApp. We arrange a free call or meeting and suggest the next steps.",
      "Directora de proyectos": "Project manager",
      "Ingeniero de redes": "Network engineer",
      "Especialista en IA": "AI specialist",
      "Desarrollador web": "Web developer",
      "Coordina cada proyecto de principio a fin y se asegura de que cumplimos plazos y presupuesto.":
        "Coordinates every project from start to finish and makes sure we meet deadlines and budget.",
      "Diseña y protege la infraestructura de red de nuestros clientes, con foco en la seguridad.":
        "Designs and protects our clients' network infrastructure, with a focus on security.",
      "Crea automatizaciones y agentes de IA que ahorran horas de trabajo repetitivo.":
        "Builds automations and AI agents that save hours of repetitive work.",
      "Construye webs y aplicaciones rápidas, accesibles y fáciles de gestionar.":
        "Builds websites and applications that are fast, accessible and easy to manage.",
      // --- Restos de la portada (reseñas de ejemplo, fechas relativas, hero) ---
      "hace crecer": "grows your business",
      "Tecnología clara que": "Clear technology that",
      "tu negocio": "your business",
      "Analizamos que necesitas de verdad y trazamos un plan realista, con presupuesto claro.":
        "We analyse what you really need and draw up a realistic plan, with a clear budget.",
      "0 incidencias": "0 incidents",
      "Cliente verificado": "Verified client",
      "Reseñas de Google": "Google reviews",
      "Hace 2 semanas": "2 weeks ago", "Hace 3 semanas": "3 weeks ago",
      "Hace 1 mes": "1 month ago", "Hace 2 meses": "2 months ago",
      "min": "min",
      "5 de 5": "5 out of 5",
      "Foto de": "Photo of", "Retrato de": "Portrait of",
      "Leer:": "Read:", "Valoración:": "Rating:",
      "de 5 estrellas": "out of 5 stars",
      "«Nos renovaron la web y automatizaron los presupuestos. Ahora ahorramos varias horas cada semana y todo es mucho más claro.»":
        "«They revamped our website and automated our quotes. We now save several hours a week and everything is much clearer.»",
      "«En una semana teníamos la red y las copias de seguridad funcionando. El soporte responde siempre rápido.»":
        "«Within a week our network and backups were up and running. Support always responds quickly.»",
      "«Un asistente de IA atiende nuestras consultas fuera de horario. Ha mejorado la atención al cliente notablemente.»":
        "«An AI assistant handles our queries outside office hours. Customer service has improved noticeably.»",
      "Nos renovaron la página web y automatizaron los presupuestos. Cumplieron los plazos y el resultado superó lo que esperábamos. Trato cercano y muy profesional.":
        "They revamped our website and automated our quotes. They met the deadlines and the result exceeded our expectations. Close and very professional service.",
      "Implantaron un asistente con IA para atender las consultas de fuera de horario. Ha reducido el trabajo repetitivo del equipo y la atención al cliente ha mejorado notablemente.":
        "They implemented an AI assistant to handle out-of-hours queries. It has reduced the team's repetitive work and customer service has improved noticeably.",
      "Montaron la red de la oficina y dejaron todo documentado. El soporte responde rápido cada vez que los necesitamos. Repetiremos sin duda.":
        "They set up the office network and left everything documented. Support responds quickly whenever we need it. We will definitely come back.",
      "Nos acompañaron en todo el proceso de digitalización. Comunicación excelente y plazos cumplidos. Es difícil encontrar un proveedor tan atento.":
        "They supported us throughout the digitalisation process. Excellent communication and deadlines met. It is hard to find such an attentive provider.",
      "La tienda online funciona perfectamente y por fin podemos gestionar los pedidos sin dolores de cabeza. Muy recomendables para pequeñas empresas.":
        "The online store works perfectly and we can finally manage orders without headaches. Highly recommended for small businesses.",
      "Nos montaron la red y las copias de seguridad en tiempo récord. El soporte posterior responde rápido. Solo echo en falta más formación al principio.":
        "They set up our network and backups in record time. Afterwards, support responds quickly. My only wish is more training at the start.",
      "Cliente": "Client",
      "ene": "Jan", "feb": "Feb", "mar": "Mar", "abr": "Apr", "may": "May", "jun": "Jun",
      "jul": "Jul", "ago": "Aug", "sep": "Sep", "oct": "Oct", "nov": "Nov", "dic": "Dec",
      "Aviso legal": "Legal notice", "Privacidad": "Privacy", "Cookies": "Cookies",
      "Logotipo de C-ROTULUS S.U.R.L.": "C-ROTULUS S.U.R.L. logo",
      "Análisis de datos y gráficas para automatizar tareas con IA":
        "Data and chart analysis to automate tasks with AI",
      "Armario de comunicaciones con cableado de red profesional":
        "Communications cabinet with professional network cabling",
      "Asistente virtual de inteligencia artificial atendiendo consultas":
        "Virtual artificial intelligence assistant handling queries",
      "Comercio local con tienda online y catálogo de productos":
        "Local shop with an online store and product catalogue",
      "Equipo de profesionales de C-ROTULUS trabajando en un proyecto":
        "Team of C-ROTULUS professionals working on a project",
      "Programador desarrollando una web moderna": "Developer building a modern website",
      "Seguridad informática: candado y datos protegidos": "IT security: padlock and protected data",
      "Foto de Marta López": "Photo of Marta López", "Foto de Javier Ruiz": "Photo of Javier Ruiz",
      "Foto de Cristina Serra": "Photo of Cristina Serra",
      "Retrato de Marta López, Directora de proyectos": "Portrait of Marta López, Project manager",
      "Retrato de Javier Ruiz, Ingeniero de redes": "Portrait of Javier Ruiz, Network engineer",
      "Retrato de Cristina Serra, Especialista en IA": "Portrait of Cristina Serra, AI specialist",
      "Retrato de Diego Marín, Desarrollador web": "Portrait of Diego Marín, Web developer",
      "1 estrella": "1 star", "2 estrellas": "2 stars", "3 estrellas": "3 stars",
      "4 estrellas": "4 stars", "5 estrellas": "5 stars",
      "4 de 5 estrellas": "4 out of 5 stars", "5 de 5 estrellas": "5 out of 5 stars",
      "Leer: Cómo la IA puede ahorrar horas a tu pyme": "Read: How AI can save your SME hours",
      "Leer: Protege tu red: 5 medidas básicas": "Read: Protect your network: 5 basic measures",
      "Leer: Una web que convierte visitas en clientes": "Read: A website that turns visits into customers",
      "Servicios tecnológicos para empresas": "Technology services for businesses",
      "C-ROTULUS S.U.R.L. | Servicios tecnológicos para empresas":
        "C-ROTULUS S.U.R.L. | Technology services for businesses",
      "Empresa | C-ROTULUS S.U.R.L. — Sobre nosotros y equipo":
        "Company | C-ROTULUS S.U.R.L. — About us and team",
      // Metadatos SEO (etiquetas <meta>): se traducen con data-i18n-content.
      "Empresa | C-ROTULUS S.U.R.L.": "Company | C-ROTULUS S.U.R.L.",
      "C-ROTULUS S.U.R.L. desarrolla software web, automatización con IA, redes, ciberseguridad y soporte técnico para empresas. Soluciones claras, seguras y a medida.":
        "C-ROTULUS S.U.R.L. develops web software, AI automation, networks, cybersecurity and technical support for businesses. Clear, secure and tailored solutions.",
      "Software web, automatización con IA, redes, ciberseguridad y soporte técnico. Tecnología clara que impulsa tu negocio.":
        "Web software, AI automation, networks, cybersecurity and technical support. Clear technology that boosts your business.",
      "Conoce a C-ROTULUS S.U.R.L.: nuestra historia, misión, visión y valores, y el equipo de profesionales que diseña y mantiene la tecnología de tu empresa.":
        "Meet C-ROTULUS S.U.R.L.: our history, mission, vision and values, and the team of professionals who design and maintain your company's technology.",
      "Nuestra historia, misión, visión, valores y el equipo detrás de C-ROTULUS.":
        "Our history, mission, vision, values and the team behind C-ROTULUS.",
      "Servicios tecnológicos para pymes y autónomos: desarrollo web, automatización e IA, redes, soporte y mantenimiento.":
        "Technology services for SMEs and freelancers: web development, AI automation, networks, support and maintenance.",
      // --- Textos editables desde el panel (Ajustes - Textos). Si el propietario
      //     los cambia, hay que actualizar su clave aqui o se pierde la traduccion.
      "Empresa de servicios tecnológicos para negocios": "Technology services company for businesses",
      "Innovación a tu alcance, tecnología a tu servicio": "Innovation within your reach, technology at your service",
      "Ayudamos a negocios en el proceso de transformación digital con soluciones informáticas a la medida, automatización con IA, redes y y comunicaciones, servicios técnicos a equipos, consultoría, diseño e impresiones y soporte técnico 24/7.":
        "We help businesses through their digital transformation with tailor-made IT solutions, AI automation, networks and communications, technical services for equipment, consulting, design and printing, and 24/7 support.",
      "Panel de control de C-ROTULUS con gráficas, servicios en la nube y una red de datos conectada":
        "C-ROTULUS control panel with charts, cloud services and a connected data network",
      "Equipo de C-ROTULUS trabajando con ordenadores en una oficina":
        "C-ROTULUS team working with computers in an office",
      "Modo mantenimiento:": "Maintenance mode:",
      "Cerrar menú de navegación": "Close navigation menu",
      "Ir al testimonio": "Go to testimonial",
      "Estamos mejorando la web. Volvemos en unos minutos.":
        "We are improving the website. We will be back in a few minutes.",
      "Un equipo profesional altamente calificado con +13 años de experiencia en el sector empresarial":
        "A highly qualified professional team with 13+ years of experience in the business sector",
      "Desde [2021] acompañamos a empresas en su transformación digital, combinando tecnología y servicios profesionales.":
        "Since [2021] we have supported businesses in their digital transformation, combining technology and professional services.",
      "Servicios tecnológicos para negocios. Desarrollo, automatización, redes y soporte con trato cercano.":
        "Technology services for businesses. Development, automation, networks and support with a personal touch.",
      "tecnología": "technology",
      "Lunes a Viernes de 9:00 a.m. a 5:00 p.m.": "Monday to Friday, 9:00 am to 5:00 pm",
      "Te acompañamos desde la primera conversación hasta el soporte del día a día.":
        "We accompany you from the first conversation to day-to-day support.",
      "Un equipo profesional y altamente calificado. Estas son las personas que te atenderán y trabajarán en tu proyecto.":
        "A highly qualified professional team. These are the people who will assist you and work on your project.",
    },
    pt: {
      // --- Rediseno de referencia (base44) ---
      "Nosotros": "Sobre nós",
      "Innovación tecnológica en Artemisa": "Inovação tecnológica em Artemisa",
      "Potenciamos tu infraestructura digital con tecnología que funciona": "Impulsionamos a sua infraestrutura digital com tecnologia que funciona",
      "infraestructura digital": "infraestrutura digital",
      "Soluciones informáticas, automatización con IA, redes y soporte para negocios en Cuba. Te acompañamos de la idea al resultado.": "Soluções informáticas, automação com IA, redes e suporte para negócios em Cuba. Acompanhamos da ideia ao resultado.",
      "Ver servicios": "Ver serviços",
      "Proyectos activos: 12 · Soporte en menos de 24 h": "Projetos ativos: 12 · Suporte em menos de 24 h",
      "clientes activos": "clientes ativos",
      "satisfacción": "satisfação",
      "Un aliado tecnológico con base en Artemisa": "Um parceiro tecnológico com base em Artemisa",
      "Confianza": "Confiança",
      "Innovación": "Inovação",
      "Cercanía": "Proximidade",
      "Eficiencia": "Eficiência",
      "Cumplimos lo que prometemos y cuidamos cada dato.": "Cumprimos o que prometemos e cuidamos de cada dado.",
      "Adoptamos IA y nuevas tecnologías con criterio.": "Adotamos IA e novas tecnologias com critério.",
      "Acompañamos a cada cliente como un socio.": "Acompanhamos cada cliente como um parceiro.",
      "Entregamos resultados medibles y a tiempo.": "Entregamos resultados mensuráveis e a tempo.",
      "Soluciones completas para tu negocio": "Soluções completas para o seu negócio",
      "Desde la infraestructura hasta la inteligencia artificial: cubrimos todo el ciclo tecnológico.": "Da infraestrutura à inteligência artificial: cobrimos todo o ciclo tecnológico.",
      "Soporte y mantenimiento": "Suporte e manutenção",
      "Soporte técnico preventivo y correctivo con tiempos de respuesta rápidos.": "Suporte técnico preventivo e corretivo com tempos de resposta rápidos.",
      "Consultoría": "Consultoria",
      "Diagnóstico tecnológico y hoja de ruta clara para tu transformación digital.": "Diagnóstico tecnológico e um roteiro claro para a sua transformação digital.",
      "Diseño e impresiones": "Design e impressões",
      "Identidad visual, material gráfico e impresión de gran formato.": "Identidade visual, material gráfico e impressão de grande formato.",
      "Instalación de redes": "Instalação de redes",
      "Cableado estructurado, Wi-Fi de alto rendimiento y configuración segura.": "Cabeamento estruturado, Wi-Fi de alto desempenho e configuração segura.",
      "Automatización con IA": "Automação com IA",
      "Automatiza tareas repetitivas y toma mejores decisiones con inteligencia artificial.": "Automatize tarefas repetitivas e tome melhores decisões com inteligência artificial.",
      "Soluciones informáticas": "Soluções informáticas",
      "Sistemas a medida, punto de venta y gestión empresarial adaptados a tu operación.": "Sistemas à medida, ponto de venda e gestão empresarial adaptados à sua operação.",
      "Saber más": "Saber mais",
      "Resultados que respaldan nuestra palabra": "Resultados que sustentam a nossa palavra",
      "Casos reales donde la tecnología marcó la diferencia.": "Casos reais em que a tecnologia fez a diferença.",
      "Telecomunicaciones": "Telecomunicações",
      "Logística": "Logística",
      "Red corporativa multi-sede": "Rede corporativa multi-site",
      "Cableado estructurado y Wi-Fi segmentado para una institución con tres sedes.": "Cabeamento estruturado e Wi-Fi segmentado para uma instituição com três unidades.",
      "Cobertura del 99% y conectividad segura entre sedes.": "Cobertura de 99% e conectividade segura entre unidades.",
      "Automatización de inventario con IA": "Automação de inventário com IA",
      "Predicción de demanda y reabastecimiento automático para un distribuidor regional.": "Previsão de procura e reabastecimento automático para um distribuidor regional.",
      "Quiebres de stock reducidos en un 60% y rotación optimizada.": "Rupturas de stock reduzidas em 60% e rotação otimizada.",
      "Modernización de punto de venta": "Modernização do ponto de venda",
      "Sistema integrado de ventas e inventario para una cadena de tiendas en Artemisa.": "Sistema integrado de vendas e inventário para uma cadeia de lojas em Artemisa.",
      "Reducción del 40% en errores de inventario y facturación 3× más rápida.": "Redução de 40% nos erros de inventário e faturação 3× mais rápida.",
      "Un proceso claro, en cinco pasos": "Um processo claro, em cinco passos",
      "Entendemos tu negocio y detectamos oportunidades.": "Compreendemos o seu negócio e identificamos oportunidades.",
      "Diseñamos una solución clara con alcance y costo.": "Desenhamos uma solução clara com âmbito e custo.",
      "Ejecutamos la solución con calidad y a tiempo.": "Executamos a solução com qualidade e a tempo.",
      "Capacitación": "Formação",
      "Tu equipo domina la nueva tecnología.": "A sua equipa domina a nova tecnologia.",
      "Acompañamiento continuo tras el lanzamiento.": "Acompanhamento contínuo após o lançamento.",
      "Gerente · Tienda La Artemiseña": "Gerente · Loja La Artemiseña",
      "C-ROTULUS transformó nuestra forma de vender. El sistema de punto de venta es rápido y el soporte siempre está disponible.": "A C-ROTULUS transformou a nossa forma de vender. O sistema de ponto de venda é rápido e o suporte está sempre disponível.",
      "Sistema de ventas 3× más rápido": "Sistema de vendas 3× mais rápido",
      "Contáctenos": "Contacte-nos",
      "Cuéntanos qué necesitas y te contactamos": "Diga-nos o que precisa e contactamos consigo",
      "Responde en menos de 24 horas hábiles. Sin compromiso.": "Responde em menos de 24 horas úteis. Sem compromisso.",
      "Atienden negocios fuera de Artemisa": "Atendem negócios fora de Artemisa",
      "¿Atienden negocios fuera de Artemisa?": "Atendem negócios fora de Artemisa?",
      "Sí. Tenemos base en Artemisa pero acompañamos clientes en todo el occidente de Cuba. Para proyectos lejanos combinamos visitas con soporte remoto.": "Sim. Estamos sediados em Artemisa mas acompanhamos clientes em todo o ocidente de Cuba. Para projetos distantes combinamos visitas com suporte remoto.",
      "¿Cuánto tarda un proyecto típico?": "Quanto tempo demora um projeto típico?",
      "Depende del alcance. Una instalación de red o punto de venta suele tomar de 1 a 3 semanas; proyectos con automatización de IA entre 4 y 8 semanas. Siempre entregamos un cronograma en la propuesta.": "Depende do âmbito. Uma instalação de rede ou ponto de venda demora normalmente 1 a 3 semanas; projetos com automação de IA entre 4 e 8 semanas. Entregamos sempre um cronograma na proposta.",
      "¿Ofrecen soporte después de la entrega?": "Oferecem suporte após a entrega?",
      "Sí. Todos los proyectos incluyen un periodo de garantía y ofrecemos planes de soporte preventivo y correctivo con tiempos de respuesta definidos.": "Sim. Todos os projetos incluem um período de garantia e oferecemos planos de suporte preventivo e corretivo com tempos de resposta definidos.",
      "¿Trabajan con equipos y software que ya tenemos?": "Trabalham com os equipamentos e software que já temos?",
      "En la mayoría de los casos, sí. Hacemos un diagnóstico inicial para aprovechar tu infraestructura existente y recomendamos cambios solo cuando aportan valor real.": "Na maioria dos casos, sim. Fazemos um diagnóstico inicial para aproveitar a sua infraestrutura existente e recomendamos mudanças apenas quando trazem valor real.",
      "¿Cómo solicito un presupuesto?": "Como solicito um orçamento?",
      "Completa el formulario de contacto o escríbenos por WhatsApp. Te respondemos en menos de 24 horas hábiles con una primera propuesta.": "Preencha o formulário de contacto ou escreva-nos por WhatsApp. Respondemos em menos de 24 horas úteis com uma primeira proposta.",
      "¿Sus soluciones funcionan sin conexión a Internet?": "As vossas soluções funcionam sem ligação à Internet?",
      "Diseñamos sistemas que operan en redes locales sin depender de Internet, ideal para entornos con conectividad limitada. La nube se usa solo cuando aporta ventajas.": "Desenhamos sistemas que operam em redes locais sem depender da Internet, ideal para ambientes com conectividade limitada. A nuvem é usada apenas quando traz vantagens.",
      "Desde 2017 acompañamos a pymes e instituciones cubanas a modernizar su infraestructura, automatizar procesos y tomar decisiones con datos.": "Desde 2017 ajudamos PME e instituições cubanas a modernizar a sua infraestrutura, automatizar processos e tomar decisões com dados.",

      // --- Navegação e cabeçalho ---
      "Inicio": "Início", "Empresa": "Empresa", "Servicios": "Serviços",
      "Proyectos": "Projetos", "Proceso": "Processo", "Testimonios": "Depoimentos",
      "Sección": "Secção", "Servicio": "Serviço", "Proyecto": "Projeto",
      "Opinión": "Avaliação", "Testimonio": "Depoimento",
      "Acceder": "Entrar", "Mi cuenta": "A minha conta", "Contacto": "Contato", "Opiniones": "Opiniões",
      "Blog": "Blog", "Ubicación": "Localização", "Preguntas frecuentes": "Perguntas frequentes",
      "Español": "Español", "English": "English", "Português": "Português",
      "Saltar al contenido principal": "Saltar para o conteúdo principal",
      "Buscar en el sitio": "Pesquisar no site",
      "Idioma del sitio": "Idioma do site",
      "Cambiar a modo noche": "Mudar para modo escuro",
      "Cambiar a modo día": "Mudar para modo claro",
      "Cerrar búsqueda": "Fechar pesquisa",
      "Abrir menú de navegación": "Abrir menu de navegação",
      "Navegación principal": "Navegação principal",
      "C-ROTULUS, ir al inicio": "C-ROTULUS, ir para o início",
      "Buscar en el sitio: servicios, proyectos, blog, preguntas…":
        "Pesquisar no site: serviços, projetos, blog, perguntas…",
      "Sin resultados. Prueba con otra palabra.": "Sem resultados. Tente outra palavra.",
      "Enlaces rápidos": "Ligações rápidas", "Síguenos": "Siga-nos",
      "Ruta de navegación": "Navegação estrutural", "Sitemap": "Mapa do site",
      "Redes sociales de C-ROTULUS": "Redes sociais da C-ROTULUS",
      "Volver arriba": "Voltar ao topo",

      // --- Hero ---
      "Agencia de servicios tecnológicos · Pymes y autónomos":
        "Agência de serviços tecnológicos · PMEs e autónomos",
      "Tecnología clara que hace crecer tu negocio":
        "Tecnologia clara que faz crescer o seu negócio",
      "Ayudamos a pymes y autónomos a digitalizarse con desarrollo web, automatización e IA, redes seguras y soporte continuo. Menos problemas, más tiempo para lo que importa.":
        "Ajudamos PMEs e autónomos a digitalizar-se com desenvolvimento web, automação e IA, redes seguras e suporte contínuo. Menos problemas, mais tempo para o que importa.",
      "Solicitar servicios": "Solicitar serviços",
      "Escríbenos por WhatsApp": "Escreva-nos no WhatsApp",
      "Descubre mas": "Descubra mais", "Descubre más": "Descubra mais",
      "Bajar a la seccion Servicios": "Descer para a secção Serviços",
      "Cifras de confianza": "Números de confiança",
      "años de experiencia": "anos de experiência",
      "clientes satisfechos": "clientes satisfeitos",
      "proyectos entregados": "projetos entregues",
      "horas de respuesta": "horas de resposta",

      // --- Maquete do agente IA (hero) ---
      "Agente IA · Facturas y firmas": "Agente IA · Faturas e assinaturas",
      "en vivo": "ao vivo", "Entrada": "Entrada",
      "factura-2026-0412.pdf recibida por correo": "fatura-2026-0412.pdf recebida por e-mail",
      "Lectura IA": "Leitura IA",
      "emisor, NIF, importe y fecha extraídos (OCR)": "emissor, NIF, valor e data extraídos (OCR)",
      "Validación": "Validação",
      "coincide con el pedido · sin duplicados": "coincide com o pedido · sem duplicados",
      "Firma digital": "Assinatura digital",
      "sellada con certificado de la empresa": "selada com o certificado da empresa",
      "Firmado": "Assinado", "4 pasos · 8 s · 0 errores": "4 passos · 8 s · 0 erros",
      "Agente de IA que recibe una factura, extrae los datos, valida, la firma digitalmente y la archiva automáticamente":
        "Agente de IA que recebe uma fatura, extrai os dados, valida, assina digitalmente e arquiva automaticamente",

      // --- Cabeçalhos de secção ---
      "Sobre nosotros": "Sobre nós", "Equipo": "Equipa", "Cómo trabajamos": "Como trabalhamos",
      "Reseñas verificadas": "Avaliações verificadas",
      "Un equipo cercano con soluciones serias": "Uma equipa próxima com soluções sérias",
      "Las personas detrás de C-ROTULUS": "As pessoas por trás da C-ROTULUS",
      "Todo lo que tu empresa necesita, en un solo equipo":
        "Tudo o que a sua empresa precisa, numa só equipa",
      "Trabajos que ya están dando resultados": "Trabalhos que já estão a dar resultados",
      "Ideas y consejos para tu negocio": "Ideias e conselhos para o seu negócio",
      "Un proceso simple, en cuatro pasos": "Um processo simples, em quatro passos",
      "Lo que opinan nuestros clientes": "O que dizem os nossos clientes",
      "Lo que opinan de nosotros en Google": "O que dizem de nós no Google",
      "Lo que dicen en Trustpilot": "O que dizem no Trustpilot",
      "Cuéntanos tu proyecto": "Conte-nos o seu projeto",
      "Dónde estamos y cómo contactarnos": "Onde estamos e como contactar-nos",
      "Resolvemos tus dudas": "Resolvemos as suas dúvidas",
      "Servicios de ejemplo fáciles de editar. Cada tarjeta incluye icono, descripción, contenido y botón de consulta.":
        "Serviços de exemplo fáceis de editar. Cada cartão inclui ícone, descrição, conteúdo e botão de consulta.",
      "Una muestra de proyectos de ejemplo. Sustituye las imágenes, los textos y las etiquetas por tus casos reales.":
        "Uma amostra de projetos de exemplo. Substitua as imagens, os textos e as etiquetas pelos seus casos reais.",
      "Publicamos guías sencillas sobre tecnología, seguridad y productividad. Sin tecnicismos innecesarios.":
        "Publicamos guias simples sobre tecnologia, segurança e produtividade. Sem termos desnecessários.",
      "Sin sorpresas: te acompañamos desde la primera conversación hasta el soporte del día a día.":
        "Sem surpresas: acompanhamos desde a primeira conversa até ao suporte do dia a dia.",
      "Opiniones de clientes reales. Comparte la tuya en un minuto, sin crear ninguna cuenta.":
        "Opiniões de clientes reais. Partilhe a sua num minuto, sem criar conta.",
      "Reseñas reales de clientes publicadas en nuestra ficha de Google. Puedes leerlas todas en un clic.":
        "Avaliações reais de clientes publicadas na nossa ficha do Google. Pode lê-las todas num clique.",
      "Opiniones reales de clientes publicadas en nuestra ficha de Trustpilot.":
        "Opiniões reais de clientes publicadas na nossa ficha do Trustpilot.",
      "Rellena el formulario y te respondemos en menos de 24 horas laborables.":
        "Preencha o formulário e respondemos em menos de 24 horas úteis.",
      "Visítanos, llámanos o escríbenos. Estamos a tu disposición en horario de oficina.":
        "Visite-nos, ligue-nos ou escreva-nos. Estamos à sua disposição em horário de expediente.",
      "Mostramos las preguntas más relevantes, ordenadas automáticamente por su importancia.":
        "Mostramos as perguntas mais relevantes, ordenadas automaticamente por importância.",
      "Desde [AÑO DE FUNDACIÓN] acompañamos a empresas en su transformación digital, combinando tecnología y trato humano.":
        "Desde [ANO DE FUNDAÇÃO] acompanhamos empresas na sua transformação digital, combinando tecnologia e trato humano.",
      "Un equipo pequeño, cercano y especializado. Estas son las personas que te atenderán y trabajarán en tu proyecto.":
        "Uma equipa pequena, próxima e especializada. Estas são as pessoas que o vão atender e trabalhar no seu projeto.",

      // --- Botões e textos comuns ---
      "Consultar": "Consultar", "Ver caso": "Ver caso", "Deja tu testimonio": "Deixe o seu depoimento",
      "Ver todas en Google": "Ver todas no Google",
      "Ver todas en Trustpilot": "Ver todas no Trustpilot",
      "Basado en": "Baseado em", "reseñas": "avaliações",
      "Enviar solicitud": "Enviar pedido",
      "Al enviar aceptas nuestra política de privacidad.":
        "Ao enviar aceita a nossa política de privacidade.",
      "Inicia sesión para proponer una pregunta": "Inicie sessão para sugerir uma pergunta",
      "Cómo llegar en Google Maps": "Como chegar no Google Maps",
      "C-ROTULUS S.U.R.L. Todos los derechos reservados.":
        "C-ROTULUS S.U.R.L. Todos os direitos reservados.",
      "Aviso legal · Privacidad · Cookies": "Aviso legal · Privacidade · Cookies",
      "Servicios tecnológicos para empresas. Desarrollo, automatización, redes y soporte con trato cercano.":
        "Serviços tecnológicos para empresas. Desenvolvimento, automação, redes e suporte com trato próximo.",

      // --- Formulários ---
      "Tu experiencia ayuda a otros": "A sua experiência ajuda outros",
      "Cuéntanos cómo fue trabajar con nosotros. Tu testimonio se publica en la portada y ayuda a otras empresas a decidirse. No necesitas cuenta.":
        "Conte-nos como foi trabalhar connosco. O seu depoimento é publicado na página inicial e ajuda outras empresas a decidir. Não precisa de conta.",
      "Se revisa antes de publicarse.": "É revisto antes de ser publicado.",
      "Puedes firmar con tu nombre y empresa.": "Pode assinar com o seu nome e empresa.",
      "Tu correo no se muestra nunca.": "O seu e-mail nunca é mostrado.",
      "Tu nombre *": "O seu nome *",
      "Cargo y empresa": "Cargo e empresa", "(opcional)": "(opcional)",
      "Tu valoración *": "A sua avaliação *",
      "Tu foto": "A sua foto", "Elegir imagen": "Escolher imagem", "Quitar": "Remover",
      "JPG, PNG o WebP. Se recorta en cuadrado y se optimiza antes de enviarse.":
        "JPG, PNG ou WebP. É recortada em quadrado e otimizada antes de ser enviada.",
      "Tu experiencia *": "A sua experiência *",
      "Verificacion de seguridad *": "Verificação de segurança *",
      "Verificación de seguridad *": "Verificação de segurança *",
      "Cargando reto…": "A carregar desafio…",
      "Resuelve la operacion para demostrar que eres una persona.":
        "Resolva a operação para provar que é uma pessoa.",
      "Resuelve la operación para demostrar que eres una persona.":
        "Resolva a operação para provar que é uma pessoa.",
      "No rellenar": "Não preencher",
      "Publicar mi testimonio": "Publicar o meu depoimento",
      "Nombre y apellidos *": "Nome completo *",
      "Correo electrónico *": "E-mail *",
      "Teléfono *": "Telefone *",
      "Servicio de interés *": "Serviço de interesse *",
      "Selecciona un servicio": "Selecione um serviço",
      "Mensaje *": "Mensagem *",
      "Otro": "Outro",
      "Desarrollo web y aplicaciones": "Desenvolvimento web e aplicações",
      "Automatización y agentes de IA": "Automação e agentes de IA",
      "Soporte técnico": "Suporte técnico",
      "Redes y ciberseguridad": "Redes e cibersegurança",
      "Consultoría tecnológica": "Consultoria tecnológica",
      "Mantenimiento integral": "Manutenção integral",
      "Ej.: María Pérez": "Ex.: María Pérez",
      "Ej.: Gerente · Distribuciones ML": "Ex.: Gestor · Distribuciones ML",
      "¿Qué problema tenías y cómo lo resolvimos?": "Que problema tinha e como o resolvemos?",
      "Generar otro reto de seguridad": "Gerar outro desafio de segurança",
      "Testimonio anterior": "Depoimento anterior", "Testimonio siguiente": "Depoimento seguinte",
      "Seleccionar testimonio": "Selecionar depoimento",
      "Testimonios de clientes": "Depoimentos de clientes",
      "Valoración: 5 de 5 estrellas": "Avaliação: 5 de 5 estrelas",
      "de 5": "de 5",
      "Escribe tu nombre.": "Escreva o seu nome.",
      "Escribe un correo válido.": "Escreva um e-mail válido.",
      "Escribe un teléfono válido (mín. 9 dígitos).": "Escreva um telefone válido (mín. 9 dígitos).",
      "Selecciona un servicio.": "Selecione um serviço.",
      "Cuéntanos un poco más (mín. 10 caracteres).": "Conte-nos um pouco mais (mín. 10 caracteres).",
      "Escribe tu nombre (mín. 2 caracteres).": "Escreva o seu nome (mín. 2 caracteres).",
      "Resuelve la operacion de seguridad.": "Resolva a operação de segurança.",
      "Resuelve la operación de seguridad.": "Resolva a operação de segurança.",
      "Revisa los campos marcados en rojo.": "Verifique os campos marcados a vermelho.",
      "Enviando...": "A enviar…", "Enviando…": "A enviar…",
      "Mensaje enviado. Gracias.": "Mensagem enviada. Obrigado.",
      "Gracias, hemos recibido tu mensaje. Te responderemos en menos de 24 horas laborables.":
        "Obrigado, recebemos a sua mensagem. Responderemos em menos de 24 horas úteis.",
      "¡Gracias! Tu testimonio se revisará antes de publicarse.":
        "Obrigado! O seu depoimento será revisto antes de ser publicado.",
      "No se pudo enviar. Inténtalo de nuevo o escríbenos por WhatsApp.":
        "Não foi possível enviar. Tente novamente ou escreva-nos no WhatsApp.",
      "No se pudo enviar. Inténtalo de nuevo en unos minutos.":
        "Não foi possível enviar. Tente novamente em alguns minutos.",
      "Verificacion no disponible": "Verificação indisponível",
      "Verificación no disponible": "Verificação indisponível",
      "Sin conexión con Google en este momento: te mostramos las últimas reseñas guardadas.":
        "Sem ligação ao Google neste momento: mostramos as últimas avaliações guardadas.",
      "Mostrando las últimas reseñas guardadas de Trustpilot.":
        "A mostrar as últimas avaliações guardadas do Trustpilot.",
      "Formato no válido. Usa JPG, PNG o WebP.": "Formato inválido. Use JPG, PNG ou WebP.",
      "Procesando la imagen…": "A processar a imagem…",
      "La imagen es demasiado grande. Prueba con otra más ligera.":
        "A imagem é demasiado grande. Tente outra mais leve.",
      "No se pudo leer la imagen. Prueba con otra.": "Não foi possível ler a imagem. Tente outra.",
      "Foto lista. Se publicará junto a tu testimonio.":
        "Foto pronta. Será publicada junto ao seu depoimento.",
      "Formulario no configurado: sustituye TU_ID en js/main.js y en el action del formulario.":
        "Formulário não configurado: substitua TU_ID em js/main.js e na action do formulário.",
      "Mapa con la ubicación de C-ROTULUS S.U.R.L. en Artemisa":
        "Mapa com a localização da C-ROTULUS S.U.R.L. em Artemisa",

      // --- Empresa ---
      "Quiénes somos": "Quem somos",
      "Somos C-ROTULUS S.U.R.L., una empresa de servicios tecnológicos. Conoce nuestra historia, lo que nos mueve y al equipo que estará a tu lado.":
        "Somos a C-ROTULUS S.U.R.L., uma empresa de serviços tecnológicos. Conheça a nossa história, o que nos move e a equipa que estará ao seu lado.",
      "Nuestra historia": "A nossa história",
      "C-ROTULUS nació con una idea sencilla: la tecnología no debería ser un dolor de cabeza. Empezamos resolviendo pequeños problemas informáticos para negocios de nuestro entorno y, con el tiempo, ampliamos el servicio hasta diseñar, desplegar y mantener la infraestructura digital completa de nuestros clientes.":
        "A C-ROTULUS nasceu de uma ideia simples: a tecnologia não devia ser uma dor de cabeça. Começámos por resolver pequenos problemas informáticos para negócios da nossa zona e, com o tempo, ampliámos o serviço até desenhar, implementar e manter toda a infraestrutura digital dos nossos clientes.",
      "Hoy trabajamos con pymes y autónomos que necesitan soluciones claras, seguras y sin sorpresas: desde una web que convierte visitas en clientes hasta la automatización de tareas con inteligencia artificial o la protección de su red.":
        "Hoje trabalhamos com PMEs e autónomos que precisam de soluções claras, seguras e sem surpresas: desde um site que converte visitas em clientes até à automação de tarefas com inteligência artificial ou à proteção da sua rede.",
      "Hoy trabajamos con pymes e instituciones que necesitan soluciones claras, seguras y sin sorpresas: desde la instalación de una red hasta la automatización de tareas con inteligencia artificial o la modernización de su punto de venta.":
        "Hoje trabalhamos com PMEs e instituições que precisam de soluções claras, seguras e sem surpresas: desde a instalação de uma rede até à automação de tarefas com inteligência artificial ou à modernização do seu ponto de venda.",
      "Nuestros valores": "Os nossos valores",
      "Cercanía y transparencia": "Proximidade e transparência",
      "Compromiso con los plazos": "Compromisso com os prazos",
      "Calidad y seguridad": "Qualidade e segurança",
      "Mejora continua": "Melhoria contínua",
      "Misión": "Missão",
      "Aportar tecnología fiable y comprensible que permita a las empresas trabajar mejor, con más seguridad y menos costes ocultos.":
        "Fornecer tecnologia fiável e compreensível que permita às empresas trabalhar melhor, com mais segurança e menos custos ocultos.",
      "Proveer soluciones informáticas confiables y accesibles que impulsen la productividad y la competitividad de los negocios en Cuba.":
        "Fornecer soluções informáticas fiáveis e acessíveis que impulsionem a produtividade e a competitividade dos negócios em Cuba.",
      "Visión": "Visão",
      "Ser el socio tecnológico de referencia de las pymes de nuestro entorno, reconocidos por la cercanía y la calidad del servicio.":
        "Ser o parceiro tecnológico de referência das PMEs da nossa zona, reconhecidos pela proximidade e pela qualidade do serviço.",
      "Ser el aliado tecnológico de referencia en el occidente del país, reconocido por nuestra calidad, cercanía y compromiso con los resultados.":
        "Ser o parceiro tecnológico de referência no ocidente de Cuba, reconhecido pela nossa qualidade, proximidade e compromisso com os resultados.",
      "¿Hablamos de tu proyecto?": "Falamos do seu projeto?",
      "Cuéntanos qué necesitas y te propondremos la mejor solución, sin compromiso.":
        "Diga-nos o que precisa e proporemos a melhor solução, sem compromisso.",
      "Solicitar presupuesto": "Solicitar orçamento",

      // --- Contacto (dados) ---
      "Teléfonos": "Telefones", "Correo": "E-mail", "Dirección": "Endereço", "Horario": "Horário",
      "Lunes a Viernes de 9:00 am a 5:00 pm": "Segunda a sexta, das 9:00 às 17:00",
      "Datos de contacto": "Dados de contacto",

      // --- Conteúdo editável (BD) ---
      "Diseño y programación": "Design e programação",
      "Productividad": "Produtividade", "Atención continua": "Apoio contínuo",
      "Infraestructura": "Infraestrutura", "Estrategia": "Estratégia",
      "Continuidad": "Continuidade",
      "Webs corporativas, tiendas online y aplicaciones a medida rápidas y fáciles de gestionar.":
        "Sites corporativos, lojas online e aplicações à medida rápidas e fáceis de gerir.",
      "Automatizamos tareas repetitivas y creamos asistentes que atienden, filtran y organizan información.":
        "Automatizamos tarefas repetitivas e criamos assistentes que atendem, filtram e organizam informação.",
      "Atención rápida para tu equipo: incidencias, equipos y software resueltos sin perder tiempo.":
        "Apoio rápido à sua equipa: incidentes, equipamentos e software resolvidos sem perder tempo.",
      "Infraestructura de red estable y protegida, con copias de seguridad y planes de contingencia.":
        "Infraestrutura de rede estável e protegida, com cópias de segurança e planos de contingência.",
      "Analizamos qué necesitas de verdad y trazamos un plan realista, con presupuesto claro.":
        "Analisamos o que precisa realmente e traçamos um plano realista, com orçamento claro.",
      "Nos ocupamos de que todo siga funcionando: actualizaciones, monitorización y mejoras continuas.":
        "Encarregamo-nos de que tudo continue a funcionar: atualizações, monitorização e melhorias contínuas.",
      "Diseño responsive": "Design responsivo", "Panel autogestionable": "Painel autogerido",
      "SEO técnico incluido": "SEO técnico incluído",
      "Chatbots y asistentes": "Chatbots e assistentes",
      "Integración entre herramientas": "Integração entre ferramentas",
      "Informes automáticos": "Relatórios automáticos",
      "Helpdesk multicanal": "Helpdesk multicanal",
      "Soporte remoto y presencial": "Suporte remoto e presencial",
      "Tiempos de respuesta acordados": "Tempos de resposta acordados",
      "Wi-Fi y cableado profesional": "Wi-Fi e cablagem profissional",
      "Firewall y antivirus gestionado": "Firewall e antivírus gerido",
      "Copias de seguridad": "Cópias de segurança",
      "Auditoría de sistemas": "Auditoria de sistemas",
      "Plan de digitalización": "Plano de digitalização",
      "Optimización de costes": "Otimização de custos",
      "Monitorización 24/7": "Monitorização 24/7",
      "Actualizaciones de seguridad": "Atualizações de segurança",
      "Informe mensual": "Relatório mensal",
      "Desarrollo web": "Desenvolvimento web", "Automatización e IA": "Automação e IA",
      "Redes y seguridad": "Redes e segurança", "Automatización": "Automação",
      "Seguridad": "Segurança",
      "Tienda online para distribuidora local": "Loja online para distribuidora local",
      "Catálogo de más de 2.000 referencias, pago integrado y panel de gestión para el equipo.":
        "Catálogo com mais de 2.000 referências, pagamento integrado e painel de gestão para a equipa.",
      "Asistente que atiende consultas 24/7": "Assistente que atende consultas 24/7",
      "Un agente de IA que responde dudas frecuentes y deriva las incidencias al equipo humano.":
        "Um agente de IA que responde a dúvidas frequentes e encaminha os incidentes para a equipa humana.",
      "Renovación de red en oficinas": "Renovação de rede em escritórios",
      "Cableado, Wi-Fi profesional y firewall gestionado para 60 puestos de trabajo.":
        "Cablagem, Wi-Fi profissional e firewall gerido para 60 postos de trabalho.",
      "Cómo la IA puede ahorrar horas a tu pyme": "Como a IA pode poupar horas à sua PME",
      "Descubre qué tareas conviene automatizar primero y cómo empezar sin complicaciones.":
        "Descubra que tarefas vale a pena automatizar primeiro e como começar sem complicações.",
      "Protege tu red: 5 medidas básicas": "Proteja a sua rede: 5 medidas básicas",
      "Cinco acciones sencillas que reducen drásticamente el riesgo de un incidente.":
        "Cinco ações simples que reduzem drasticamente o risco de um incidente.",
      "Una web que convierte visitas en clientes": "Um site que converte visitas em clientes",
      "Qué debe tener tu web para que quien llega termine contactando contigo.":
        "O que o seu site deve ter para que quem chega acabe por contactá-lo.",
      "Diagnóstico": "Diagnóstico", "Propuesta": "Proposta",
      "Implementación": "Implementação", "Soporte": "Suporte",
      "Escuchamos tus necesidades y analizamos el estado actual de tu tecnología.":
        "Ouvimos as suas necessidades e analisamos o estado atual da sua tecnologia.",
      "Recibes una solución clara, con alcance, plazos y precio cerrado.":
        "Recebe uma solução clara, com âmbito, prazos e preço fixo.",
      "Ejecutamos el proyecto con seguimiento y pruebas antes de la entrega.":
        "Executamos o projeto com acompanhamento e testes antes da entrega.",
      "Te acompañamos después: mantenimiento, mejoras y atención cuando lo necesites.":
        "Acompanhamos depois: manutenção, melhorias e apoio quando precisar.",
      "Nos renovaron la web y automatizaron los presupuestos. Ahora ahorramos varias horas cada semana y todo es mucho más claro.":
        "Renovaram o nosso site e automatizaram os orçamentos. Agora poupamos várias horas por semana e tudo é muito mais claro.",
      "En una semana teníamos la red y las copias de seguridad funcionando. El soporte responde siempre rápido.":
        "Numa semana tínhamos a rede e as cópias de segurança a funcionar. O suporte responde sempre rápido.",
      "Un asistente de IA atiende nuestras consultas fuera de horario. Ha mejorado la atención al cliente notablemente.":
        "Um assistente de IA atende as nossas consultas fora de horário. A atenção ao cliente melhorou bastante.",
      "Gerente · Distribuciones ML": "Gestor · Distribuciones ML",
      "Director · Talleres Ruiz": "Diretor · Talleres Ruiz",
      "Fundadora · CliniSalud": "Fundadora · CliniSalud",
      "de solicitudes online en 3 meses": "de pedidos online em 3 meses",
      "+40% de solicitudes online en 3 meses": "+40% de pedidos online em 3 meses",
      "0 incidencias críticas en 12 meses": "0 incidentes críticos em 12 meses",
      "70% de consultas resueltas sin espera": "70% das consultas resolvidas sem espera",
      "críticas en 12 meses": "incidentes críticos em 12 meses",
      "de consultas resueltas sin espera": "de consultas resolvidas sem espera",
      "¿Cuánto cuesta un proyecto?": "Quanto custa um projeto?",
      "Depende del alcance. Tras el diagnóstico gratuito te entregamos un presupuesto cerrado y sin compromiso, con todo detallado.":
        "Depende do âmbito. Após o diagnóstico gratuito entregamos um orçamento fixo e sem compromisso, com tudo detalhado.",
      "¿Cuánto tardáis en entregar?": "Quanto tempo demoram a entregar?",
      "Una web corporativa suele estar en 2-4 semanas. Los proyectos de automatización o redes dependen del alcance; acordamos plazos antes de empezar.":
        "Um site corporativo costuma estar pronto em 2-4 semanas. Os projetos de automação ou redes dependem do âmbito; acordamos prazos antes de começar.",
      "¿Ofrecéis garantía?": "Oferecem garantia?",
      "Sí. Todo trabajo incluye garantía sobre lo entregado y, opcionalmente, un plan de mantenimiento para mantenerlo actualizado y seguro.":
        "Sim. Todo o trabalho inclui garantia sobre o que é entregue e, opcionalmente, um plano de manutenção para o manter atualizado e seguro.",
      "¿Qué incluye el soporte?": "O que inclui o suporte?",
      "Atención por teléfono, correo o WhatsApp, resolución de incidencias, actualizaciones de seguridad y asesoramiento según el plan contratado.":
        "Atendimento por telefone, e-mail ou WhatsApp, resolução de incidentes, atualizações de segurança e aconselhamento conforme o plano contratado.",
      "¿Cómo puedo pagar?": "Como posso pagar?",
      "Aceptamos transferencia bancaria y pago con tarjeta. En proyectos grandes, un anticipo al empezar y el resto a la entrega.":
        "Aceitamos transferência bancária e pagamento com cartão. Em projetos grandes, um adiantamento no início e o resto na entrega.",
      "¿Cómo empiezo?": "Como começo?",
      "Escríbenos por el formulario o WhatsApp. Concertamos una llamada o reunión sin coste y te proponemos los siguientes pasos.":
        "Escreva-nos pelo formulário ou WhatsApp. Marcamos uma chamada ou reunião sem custo e propomos os próximos passos.",
      "Directora de proyectos": "Diretora de projetos",
      "Ingeniero de redes": "Engenheiro de redes",
      "Especialista en IA": "Especialista em IA",
      "Desarrollador web": "Programador web",
      "Coordina cada proyecto de principio a fin y se asegura de que cumplimos plazos y presupuesto.":
        "Coordena cada projeto do início ao fim e garante que cumprimos prazos e orçamento.",
      "Diseña y protege la infraestructura de red de nuestros clientes, con foco en la seguridad.":
        "Desenha e protege a infraestrutura de rede dos nossos clientes, com foco na segurança.",
      "Crea automatizaciones y agentes de IA que ahorran horas de trabajo repetitivo.":
        "Cria automações e agentes de IA que poupam horas de trabalho repetitivo.",
      "Construye webs y aplicaciones rápidas, accesibles y fáciles de gestionar.":
        "Constrói sites e aplicações rápidos, acessíveis e fáceis de gerir.",
      // --- Restos da página inicial (avaliações de exemplo, datas relativas, hero) ---
      "hace crecer": "faz crescer o seu negócio",
      "Tecnología clara que": "Tecnologia clara que",
      "tu negocio": "o seu negócio",
      "Analizamos que necesitas de verdad y trazamos un plan realista, con presupuesto claro.":
        "Analisamos o que precisa realmente e traçamos um plano realista, com orçamento claro.",
      "0 incidencias": "0 incidentes",
      "Cliente verificado": "Cliente verificado",
      "Reseñas de Google": "Avaliações do Google",
      "Hace 2 semanas": "Há 2 semanas", "Hace 3 semanas": "Há 3 semanas",
      "Hace 1 mes": "Há 1 mês", "Hace 2 meses": "Há 2 meses",
      "min": "min",
      "5 de 5": "5 de 5",
      "Foto de": "Foto de", "Retrato de": "Retrato de",
      "Leer:": "Ler:", "Valoración:": "Avaliação:",
      "de 5 estrellas": "de 5 estrelas",
      "«Nos renovaron la web y automatizaron los presupuestos. Ahora ahorramos varias horas cada semana y todo es mucho más claro.»":
        "«Renovaram o nosso site e automatizaram os orçamentos. Agora poupamos várias horas por semana e tudo é muito mais claro.»",
      "«En una semana teníamos la red y las copias de seguridad funcionando. El soporte responde siempre rápido.»":
        "«Numa semana tínhamos a rede e as cópias de segurança a funcionar. O suporte responde sempre rápido.»",
      "«Un asistente de IA atiende nuestras consultas fuera de horario. Ha mejorado la atención al cliente notablemente.»":
        "«Um assistente de IA atende as nossas consultas fora de horário. A atenção ao cliente melhorou bastante.»",
      "Nos renovaron la página web y automatizaron los presupuestos. Cumplieron los plazos y el resultado superó lo que esperábamos. Trato cercano y muy profesional.":
        "Renovaram o nosso site e automatizaram os orçamentos. Cumpriram os prazos e o resultado superou o que esperávamos. Trato próximo e muito profissional.",
      "Implantaron un asistente con IA para atender las consultas de fuera de horario. Ha reducido el trabajo repetitivo del equipo y la atención al cliente ha mejorado notablemente.":
        "Implementaram um assistente de IA para atender as consultas fora de horário. Reduziu o trabalho repetitivo da equipa e a atenção ao cliente melhorou bastante.",
      "Montaron la red de la oficina y dejaron todo documentado. El soporte responde rápido cada vez que los necesitamos. Repetiremos sin duda.":
        "Montaram a rede do escritório e deixaram tudo documentado. O suporte responde rápido sempre que precisamos. Repetiremos sem dúvida.",
      "Nos acompañaron en todo el proceso de digitalización. Comunicación excelente y plazos cumplidos. Es difícil encontrar un proveedor tan atento.":
        "Acompanharam-nos em todo o processo de digitalização. Comunicação excelente e prazos cumpridos. É difícil encontrar um fornecedor tão atento.",
      "La tienda online funciona perfectamente y por fin podemos gestionar los pedidos sin dolores de cabeza. Muy recomendables para pequeñas empresas.":
        "A loja online funciona perfeitamente e finalmente podemos gerir os pedidos sem dores de cabeça. Muito recomendáveis para pequenas empresas.",
      "Nos montaron la red y las copias de seguridad en tiempo récord. El soporte posterior responde rápido. Solo echo en falta más formación al principio.":
        "Montaram a nossa rede e as cópias de segurança em tempo recorde. O suporte posterior responde rápido. Só sinto falta de mais formação no início.",
      "Cliente": "Cliente",
      "ene": "jan", "feb": "fev", "mar": "mar", "abr": "abr", "may": "mai", "jun": "jun",
      "jul": "jul", "ago": "ago", "sep": "set", "oct": "out", "nov": "nov", "dic": "dez",
      "Aviso legal": "Aviso legal", "Privacidad": "Privacidade", "Cookies": "Cookies",
      "Logotipo de C-ROTULUS S.U.R.L.": "Logótipo da C-ROTULUS S.U.R.L.",
      "Análisis de datos y gráficas para automatizar tareas con IA":
        "Análise de dados e gráficos para automatizar tarefas com IA",
      "Armario de comunicaciones con cableado de red profesional":
        "Armário de comunicações com cablagem de rede profissional",
      "Asistente virtual de inteligencia artificial atendiendo consultas":
        "Assistente virtual de inteligência artificial a atender consultas",
      "Comercio local con tienda online y catálogo de productos":
        "Comércio local com loja online e catálogo de produtos",
      "Equipo de profesionales de C-ROTULUS trabajando en un proyecto":
        "Equipa de profissionais da C-ROTULUS a trabalhar num projeto",
      "Programador desarrollando una web moderna": "Programador a desenvolver um site moderno",
      "Seguridad informática: candado y datos protegidos": "Segurança informática: cadeado e dados protegidos",
      "Foto de Marta López": "Foto de Marta López", "Foto de Javier Ruiz": "Foto de Javier Ruiz",
      "Foto de Cristina Serra": "Foto de Cristina Serra",
      "Retrato de Marta López, Directora de proyectos": "Retrato de Marta López, Diretora de projetos",
      "Retrato de Javier Ruiz, Ingeniero de redes": "Retrato de Javier Ruiz, Engenheiro de redes",
      "Retrato de Cristina Serra, Especialista en IA": "Retrato de Cristina Serra, Especialista em IA",
      "Retrato de Diego Marín, Desarrollador web": "Retrato de Diego Marín, Programador web",
      "1 estrella": "1 estrela", "2 estrellas": "2 estrelas", "3 estrellas": "3 estrelas",
      "4 estrellas": "4 estrelas", "5 estrellas": "5 estrelas",
      "4 de 5 estrellas": "4 de 5 estrelas", "5 de 5 estrellas": "5 de 5 estrelas",
      "Leer: Cómo la IA puede ahorrar horas a tu pyme": "Ler: Como a IA pode poupar horas à sua PME",
      "Leer: Protege tu red: 5 medidas básicas": "Ler: Proteja a sua rede: 5 medidas básicas",
      "Leer: Una web que convierte visitas en clientes": "Ler: Um site que converte visitas em clientes",
      "Servicios tecnológicos para empresas": "Serviços tecnológicos para empresas",
      "C-ROTULUS S.U.R.L. | Servicios tecnológicos para empresas":
        "C-ROTULUS S.U.R.L. | Serviços tecnológicos para empresas",
      "Empresa | C-ROTULUS S.U.R.L. — Sobre nosotros y equipo":
        "Empresa | C-ROTULUS S.U.R.L. — Sobre nós e equipa",
      // Metadatos SEO (etiquetas <meta>): se traducen con data-i18n-content.
      "Empresa | C-ROTULUS S.U.R.L.": "Empresa | C-ROTULUS S.U.R.L.",
      "C-ROTULUS S.U.R.L. desarrolla software web, automatización con IA, redes, ciberseguridad y soporte técnico para empresas. Soluciones claras, seguras y a medida.":
        "A C-ROTULUS S.U.R.L. desenvolve software web, automação com IA, redes, cibersegurança e suporte técnico para empresas. Soluções claras, seguras e à medida.",
      "Software web, automatización con IA, redes, ciberseguridad y soporte técnico. Tecnología clara que impulsa tu negocio.":
        "Software web, automação com IA, redes, cibersegurança e suporte técnico. Tecnologia clara que impulsiona o seu negócio.",
      "Conoce a C-ROTULUS S.U.R.L.: nuestra historia, misión, visión y valores, y el equipo de profesionales que diseña y mantiene la tecnología de tu empresa.":
        "Conheça a C-ROTULUS S.U.R.L.: a nossa história, missão, visão e valores, e a equipa de profissionais que concebe e mantém a tecnologia da sua empresa.",
      "Nuestra historia, misión, visión, valores y el equipo detrás de C-ROTULUS.":
        "A nossa história, missão, visão, valores e a equipa por trás da C-ROTULUS.",
      "Servicios tecnológicos para pymes y autónomos: desarrollo web, automatización e IA, redes, soporte y mantenimiento.":
        "Serviços tecnológicos para PMEs e profissionais independentes: desenvolvimento web, automação com IA, redes, suporte e manutenção.",
      "Empresa de servicios tecnológicos para negocios": "Empresa de serviços tecnológicos para negócios",
      "Innovación a tu alcance, tecnología a tu servicio": "Inovação ao seu alcance, tecnologia ao seu serviço",
      "Ayudamos a negocios en el proceso de transformación digital con soluciones informáticas a la medida, automatización con IA, redes y y comunicaciones, servicios técnicos a equipos, consultoría, diseño e impresiones y soporte técnico 24/7.":
        "Ajudamos os negócios no processo de transformação digital com soluções informáticas à medida, automação com IA, redes e comunicações, serviços técnicos a equipamentos, consultoria, design e impressão e suporte técnico 24/7.",
      "Panel de control de C-ROTULUS con gráficas, servicios en la nube y una red de datos conectada":
        "Painel de controlo da C-ROTULUS com gráficos, serviços na nuvem e uma rede de dados ligada",
      "Equipo de C-ROTULUS trabajando con ordenadores en una oficina":
        "Equipa da C-ROTULUS a trabalhar com computadores num escritório",
      "Modo mantenimiento:": "Modo de manutenção:",
      "Cerrar menú de navegación": "Fechar menu de navegação",
      "Ir al testimonio": "Ir para o depoimento",
      "Estamos mejorando la web. Volvemos en unos minutos.":
        "Estamos a melhorar o site. Voltamos em alguns minutos.",
      "Un equipo profesional altamente calificado con +13 años de experiencia en el sector empresarial":
        "Uma equipa profissional altamente qualificada com +13 anos de experiência no setor empresarial",
      "Desde [2021] acompañamos a empresas en su transformación digital, combinando tecnología y servicios profesionales.":
        "Desde [2021] acompanhamos empresas na sua transformação digital, combinando tecnologia e serviços profissionais.",
      "Servicios tecnológicos para negocios. Desarrollo, automatización, redes y soporte con trato cercano.":
        "Serviços tecnológicos para negócios. Desenvolvimento, automação, redes e suporte com trato próximo.",
      "tecnología": "tecnologia",
      "Lunes a Viernes de 9:00 a.m. a 5:00 p.m.": "Segunda a sexta, das 9:00 às 17:00",
      "Te acompañamos desde la primera conversación hasta el soporte del día a día.":
        "Acompanhamos-te desde a primeira conversa até ao suporte do dia a dia.",
      "Un equipo profesional y altamente calificado. Estas son las personas que te atenderán y trabajarán en tu proyecto.":
        "Uma equipa profissional altamente qualificada. Estas são as pessoas que o vão atender e trabalhar no seu projeto.",
    }
  };

  /* Traduce una cadena. Si no hay traducción, devuelve el texto original. */
  function t(texto) {
    if (texto == null) return "";
    var idioma = document.documentElement.getAttribute("data-lang") || "es";
    if (idioma === "es") return String(texto);
    var dic = I18N[idioma] || {};
    var clave = String(texto).replace(/\s+/g, " ").trim();
    return dic[clave] !== undefined ? dic[clave] : String(texto);
  }

  /* Idiomas distintos del español, para pedir el contenido traducido a la API. */
  function idiomaActivo() {
    return document.documentElement.getAttribute("data-lang") || "es";
  }

  /* Conjunto de textos en español con traducción disponible (claves del
     diccionario). Solo se tocan los nodos y atributos cuyo texto esté aquí:
     así no se traduce por error texto dinámico (importes, fechas, nombres...). */
  var I18N_CLAVES = (function () {
    var set = {};
    ["en", "pt"].forEach(function (idioma) {
      Object.keys(I18N[idioma] || {}).forEach(function (k) { set[k] = 1; });
    });
    return set;
  })();

  function claveI18n(texto) {
    return String(texto == null ? "" : texto).replace(/\s+/g, " ").trim();
  }

  /* Fechas y minutos del contenido de ejemplo ("13 oct 2026", "4 min"). Se
     traducen por patrón porque el texto no es una clave fija del diccionario. */
  var MESES_ABREV = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function traducirPatron(texto, idioma) {
    if (idioma === "es") return texto;
    var sep = "";
    var cuerpo = texto;
    var mSep = /^([·•])\s*(.+)$/.exec(texto);
    if (mSep) { sep = mSep[1] + " "; cuerpo = mSep[2]; }
    var m = /^(\d{1,2})\s+([a-záéíóúñ]{3})\s+(\d{4})$/.exec(cuerpo);
    if (m) {
      var mes = MESES_ABREV.indexOf(m[2]);
      if (mes !== -1) return sep + m[1] + " " + t(MESES_ABREV[mes]) + " " + m[3];
    }
    var mm = /^(\d+)\s+min$/.exec(cuerpo);
    if (mm) return sep + mm[1] + " " + t("min");
    return null;
  }

  /* Originales ya vistos (nodo -> texto en español) para poder volver atrás. */
  var i18nOriginales = new WeakMap();

  var I18N_ATRIBUTOS = [
    ["data-i18n-aria", "aria-label"],
    ["data-i18n-ph", "placeholder"],
    ["data-i18n-alt", "alt"],
    ["data-i18n-title", "title"],
    ["data-i18n-content", "content"]
  ];

  var I18N_IGNORAR = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1 };

  /* Traduce los nodos de texto y los atributos marcados, en el idioma activo.
     Se puede llamar tantas veces como haga falta: guarda el texto original y
     siempre parte de él, así cambiar de idioma no encadena traducciones. */
  function aplicarIdiomaDOM() {
    var idioma = idiomaActivo();
    if (!document.body) return;

    var caminante = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var nodo;
    while ((nodo = caminante.nextNode())) {
      var padre = nodo.parentNode;
      if (padre && I18N_IGNORAR[padre.nodeName]) continue;
      var bruto = nodo.nodeValue;
      var clave = claveI18n(bruto);
      if (!clave) continue;
      var original = i18nOriginales.get(nodo);
      if (original === undefined) {
        if (!I18N_CLAVES[clave] && !traducirPatron(clave, "en") && !traducirPatron(clave, "pt")) continue;
        original = clave;
        i18nOriginales.set(nodo, original);
      }
      // Se conservan los espacios de los extremos (texto en linea junto a <strong>).
      var mPrefijo = /^\s*/.exec(bruto)[0];
      var mSufijo = /\s*$/.exec(bruto)[0];
      var nuevo = idioma === "es" ? original : (traducirPatron(original, idioma) || t(original) || original);
      if (nodo.nodeValue !== mPrefijo + nuevo + mSufijo) nodo.nodeValue = mPrefijo + nuevo + mSufijo;
    }

    I18N_ATRIBUTOS.forEach(function (par) {
      var marcador = par[0], atributo = par[1], guardado = marcador + "-es";
      $$("[" + marcador + "]").forEach(function (el) {
        var original = el.getAttribute(guardado);
        if (original === null) {
          original = el.getAttribute(atributo) || "";
          if (!I18N_CLAVES[claveI18n(original)]) return;
          el.setAttribute(guardado, original);
        }
        el.setAttribute(atributo, idioma === "es" ? original : (t(original) || original));
      });
    });
  }

  /* Aplica el idioma a toda la página y lo recuerda. */
  function aplicarIdioma(idioma) {
    if (idioma !== "es" && idioma !== "en" && idioma !== "pt") idioma = "es";
    document.documentElement.setAttribute("lang", idioma);
    document.documentElement.setAttribute("data-lang", idioma);
    try { localStorage.setItem("crotulus_lang", idioma); } catch (e) { /* privacidad */ }
    aplicarIdiomaDOM();
    var code = $("#langCode");
    if (code) code.textContent = idioma.toUpperCase();
    $$("#langMenu [data-lang]").forEach(function (b) {
      b.setAttribute("aria-current", b.getAttribute("data-lang") === idioma ? "true" : "false");
    });
    // El botón de tema cambia su etiqueta según el idioma y el modo activo.
    var themeBtn = $("#themeToggle");
    if (themeBtn) {
      var oscuro = document.documentElement.classList.contains("theme-dark");
      themeBtn.setAttribute("aria-label", oscuro ? t("Cambiar a modo día") : t("Cambiar a modo noche"));
    }
    // El buscador ya abierto se vuelve a pintar en el idioma nuevo.
    var panel = $("#siteSearch");
    var entrada = $("#searchInput");
    if (panel && entrada && !panel.hidden) {
      entrada.dispatchEvent(new Event("input"));
    }
    aplicarTitulo();
  }

  /* Titulo de la pestaña: se guarda el original en español y se traduce. */
  var TITULO_ES = null;
  function aplicarTitulo() {
    if (TITULO_ES === null) TITULO_ES = document.title;
    var idioma = idiomaActivo();
    document.title = idioma === "es" ? TITULO_ES : (t(TITULO_ES) || TITULO_ES);
  }


  function setupLangSwitch() {
    var guardado = "";
    try { guardado = localStorage.getItem("crotulus_lang") || ""; } catch (e) { /* privacidad */ }
    if (guardado) aplicarIdioma(guardado);

    var toggle = $("#langToggle");
    var menu = $("#langMenu");
    if (toggle && menu) {
      toggle.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var abierto = !menu.hidden;
        menu.hidden = abierto;
        toggle.setAttribute("aria-expanded", abierto ? "false" : "true");
      });
      document.addEventListener("click", function (ev) {
        if (menu.hidden) return;
        if (!menu.contains(ev.target) && ev.target !== toggle) {
          menu.hidden = true;
          toggle.setAttribute("aria-expanded", "false");
        }
      });
      document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape" && !menu.hidden) {
          menu.hidden = true;
          toggle.setAttribute("aria-expanded", "false");
        }
      });
    }
    $$("#langMenu [data-lang]").forEach(function (b) {
      b.addEventListener("click", function () {
        var idioma = b.getAttribute("data-lang");
        if (idioma === idiomaActivo()) { if (menu) menu.hidden = true; return; }
        aplicarIdioma(idioma);
        // El contenido editable (servicios, proyectos, blog, FAQ...) viene de la
        // base de datos: se vuelve a pedir para pintarlo en el idioma nuevo.
        recargarContenidoIdioma();
        if (menu) menu.hidden = true;
        if (toggle) toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* Vuelve a cargar los datos y el contenido editable en el idioma activo. */
  function recargarContenidoIdioma() {
    var idioma = idiomaActivo();
    if (idioma !== "es") {
      loadContent();
      loadBlog();
      loadTeam();
      // Los textos de los ajustes (portada, cabeceras, pie) se traducen por
      // diccionario; al reaplicarlos se pisan con la versión del idioma activo.
      loadSiteData();
    } else {
      location.reload();
    }
  }

  function setupTheme() {
    var guardado = "";
    try { guardado = localStorage.getItem("crotulus_theme") || ""; } catch (e) { /* privacidad */ }
    // Preferencia del sistema si el visitante no ha elegido nada.
    if (!guardado && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      guardado = "dark";
    }
    var btn = $("#themeToggle");
    function pintar() {
      var oscuro = document.documentElement.classList.contains("theme-dark");
      if (btn) {
        btn.setAttribute("aria-pressed", oscuro ? "true" : "false");
        aplicarIdioma(document.documentElement.getAttribute("data-lang") || "es");
      }
    }
    if (guardado === "dark") document.documentElement.classList.add("theme-dark");
    pintar();
    if (btn) {
      btn.addEventListener("click", function () {
        var oscuro = document.documentElement.classList.toggle("theme-dark");
        try { localStorage.setItem("crotulus_theme", oscuro ? "dark" : "light"); } catch (e) { /* privacidad */ }
        pintar();
      });
    }
  }

  /* --- Buscador global ---------------------------------------------------- */
  function normalizar(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* Recorre el documento y devuelve el índice de resultados. Se hace en cada
     búsqueda para incluir el contenido cargado por la API. */
  function indiceBusqueda() {
    var items = [];
    var vistos = {};
    function add(tag, titulo, texto, href) {
      if (!titulo) return;
      var clave = href + "|" + titulo;
      if (vistos[clave]) return;
      vistos[clave] = 1;
      items.push({ tag: tag, titulo: titulo, texto: texto, href: href });
    }
    // Secciones con ancla.
    $$("section[id]").forEach(function (sec) {
      if (sec.hidden) return;
      var id = sec.getAttribute("id");
      var h = $(".section__title, .hero__title, .page-hero__title", sec);
      var lead = $(".section__lead, .hero__subtitle, .page-hero__lead", sec);
      add("Sección", h ? h.textContent : "", lead ? lead.textContent : "", "#" + id);
    });
    // Elementos de contenido dentro de cada sección.
    var mapa = [
      [".card", "Servicio", ".card__title, .card__text"],
      [".project", "Proyecto", ".project__title, .project__text, .project__tag"],
      [".post", "Blog", ".post__title, .post__text, .post__tag"],
      [".step", "Proceso", ".step__title, .step__text"],
      [".accordion__item", "FAQ", ".accordion__trigger, .accordion__panel"],
      [".review-card", "Opinión", ".review-card__author, .review-card__text"],
      [".testimonial__quote", "Testimonio", "p, cite"]
    ];
    mapa.forEach(function (def) {
      $$(def[0]).forEach(function (el) {
        var sec = el.closest("section[id]");
        var id = sec ? sec.getAttribute("id") : "";
        var h = $(def[2], el);
        add(def[1], h ? h.textContent : el.textContent, "", id ? "#" + id : "#inicio");
      });
    });
    return items;
  }

  function setupSiteSearch() {
    var panel = $("#siteSearch");
    var input = $("#searchInput");
    var lista = $("#searchResults");
    var toggle = $("#searchToggle");
    var cerrar = $("#searchClose");
    if (!panel || !input || !lista || !toggle) return;

    var indice = null;
    function abrir() {
      indice = indiceBusqueda();
      panel.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      input.focus();
    }
    function ocultar() {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    }
    function pintarResultados(q) {
      var nq = normalizar(q);
      lista.innerHTML = "";
      if (!nq) return;
      var res = indice.filter(function (it) {
        return normalizar(it.titulo + " " + it.texto).indexOf(nq) !== -1;
      }).slice(0, 8);
      if (!res.length) {
        var li = document.createElement("li");
        li.className = "search-empty";
        li.textContent = t("Sin resultados. Prueba con otra palabra.");
        lista.appendChild(li);
        return;
      }
      res.forEach(function (it) {
        var a = document.createElement("a");
        a.className = "search-result";
        a.href = it.href;
        a.innerHTML = '<span class="search-result__tag">' + esc(t(it.tag)) + "</span>" +
          '<span class="search-result__text"><strong>' + esc(it.titulo) + "</strong>" +
          (it.texto ? "<span>" + esc(it.texto.slice(0, 90)) + "</span>" : "") + "</span>";
        a.addEventListener("click", function () { ocultar(); });
        var li = document.createElement("li");
        li.appendChild(a);
        lista.appendChild(li);
      });
    }
    toggle.addEventListener("click", function (ev) {
      ev.stopPropagation();
      panel.hidden ? abrir() : ocultar();
    });
    if (cerrar) cerrar.addEventListener("click", ocultar);
    input.addEventListener("input", function () { pintarResultados(input.value); });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && !panel.hidden) ocultar();
    });
    document.addEventListener("click", function (ev) {
      if (panel.hidden) return;
      if (!panel.contains(ev.target) && ev.target !== toggle && !toggle.contains(ev.target)) ocultar();
    });
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
        status.textContent = t("Sin conexión con Google en este momento: te mostramos las últimas reseñas guardadas.");
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
        status.textContent = t("Mostrando las últimas reseñas guardadas de Trustpilot.");
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
