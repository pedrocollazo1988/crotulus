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

  // >>> ENDPOINT DEL FORMULARIO <<<
  // Por defecto usamos el backend propio incluido en este proyecto (PHP), que
  // guarda los mensajes en la base de datos y aplica validación y seguridad.
  // Si prefieres un servicio externo, pon aquí su URL, por ejemplo:
  //     var FORM_ENDPOINT = "https://formspree.io/f/TU_ID";
  // (en ese caso recuerda cambiar también el "action" del <form> en index.html)
  var FORM_ENDPOINT = "api/contact.php";

  // Base de la API del sitio (datos editables: teléfono, correo, mapa, redes).
  var API_BASE = "api/";

  // Datos de contacto de reserva (se usan si la API no responde).
  var CONTACTO = {
    teléfono: "+34000000000",     // [TELÉFONO]
    whatsapp: "34000000000",      // [WHATSAPP] (solo dígitos, con prefijo país)
    correo: "info@c-rotulus.example", // [CORREO]
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
    setupAccordion();
    setupCarousel();
    setupBackTop();
    setupForm();
    setupWhatsAppLinks();   // valores por defecto (por si la API no responde)
    loadSiteData();         // datos reales desde el backend (si está disponible)
    loadContent();          // contenido editable (servicios, proyectos, faq...)
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
      fetch(API_BASE + "index.php?resource=content&type=" + encodeURIComponent(tipo), { headers: { "Accept": "application/json" } })
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

  // Escapa texto antes de insertarlo (defensa contra XSS).
  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
    var img  = meta.image ? esc(meta.image) : "assets/img/proyecto-web.svg";
    return '<article class="project"><div class="project__media"><img src="' + img + '" alt="' + esc(it.title) + '" loading="lazy" decoding="async"></div>'
      + '<div class="project__body"><span class="project__tag">' + esc(it.subtitle) + '</span>'
      + '<h3 class="project__title">' + esc(it.title) + '</h3>'
      + '<p class="project__text">' + esc(it.body) + '</p>'
      + '<a class="project__link" href="#contacto">Ver caso &rarr;</a></div></article>';
  }
  function itemTestimonio(it) {
    var meta = it.meta || {};
    return '<li class="testimonial"><blockquote class="testimonial__quote"><p>"' + esc(it.body) + '"</p></blockquote>'
      + '<footer class="testimonial__author"><span class="testimonial__avatar" aria-hidden="true">' + iniciales(it.title) + '</span>'
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
    fetch(API_BASE + "index.php?resource=settings", { headers: { "Accept": "application/json" } })
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

    // Enlaces tel:/mailto: de toda la página
    $$('a[href^="tel:"]').forEach(function (a) {
      if (tel && tel.indexOf("[") === -1) a.setAttribute("href", "tel:" + tel.replace(/[^\d+]/g, ""));
    });
    $$('a[href^="mailto:"]').forEach(function (a) {
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
    setupWhatsAppLinks();
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
    $$('a[href^="#"]').forEach(function (link) {
      link.addEventListener("click", function (e) {
        var id = link.getAttribute("href");
        if (!id || id === "#") return;
        var target = document.querySelector(id);
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
    var links = $$(".nav-link");
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
    var items = $$(".section__head, .card, .project, .step, .mv-card, .stat, .about__media, .about__body, .testimonial, .accordion, .contact-form, .contact-info");
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
     4. CONTADOR ANIMADO DE LAS CIFRAS DE CONFIANZA
     ========================================================================== */
  function setupCounters() {
    var nums = $$(".stat__num");
    if (!nums.length || prefersReduced || !("IntersectionObserver" in window)) return;

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        animate(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: .5 });

    nums.forEach(function (n) { observer.observe(n); });

    function animate(el) {
      var target = parseInt(el.getAttribute("data-count"), 10) || 0;
      var duration = 1200, start = null;
      requestAnimationFrame(function step(ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        el.textContent = Math.floor(p * target) + (p === 1 ? "+" : "");
        if (p < 1) requestAnimationFrame(step);
      });
    }
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

    // Reglas de validación por campo
    var reglas = {
      nombre:   { req: true, msg: "Escribe tu nombre." },
      correo:   { req: true, email: true, msg: "Escribe un correo válido." },
      teléfono: { req: true, tel: true, msg: "Escribe un teléfono válido (mín. 9 dígitos)." },
      servicio: { req: true, msg: "Selecciona un servicio." },
      mensaje:  { req: true, min: 10, msg: "Cuéntanos un poco más (mín. 10 caracteres)." }
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
      if (r.min && v.length < r.min) return setError(input, r.msg);
      return setError(input, "");
    }

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
      })
      .catch(function () {
        status.textContent = "No se pudo enviar. Inténtalo de nuevo o escríbenos por WhatsApp.";
        status.className = "form-status is-error";
      });
  }

  /* Pide un token CSRF a la API (lo guarda en la sesión del servidor). */
  function obtenerCsrf() {
    return fetch(API_BASE + "index.php?action=csrf", { headers: { "Accept": "application/json" } })
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
})();
