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
  // Crea una cuenta gratis en https://formspree.io, obtiene tu ID y sustituye
  // "TU_ID" por el que te den. Debe coincidir con el atributo action del <form>.
  var FORM_ENDPOINT = "https://formspree.io/f/TU_ID";

  // Datos de contacto (formato internacional, sin espacios ni simbolos):
  var CONTACTO = {
    teléfono: "+34000000000",     // [TELÉFONO]
    whatsapp: "34000000000",      // [WHATSAPP] (solo digitos, con prefijo pais)
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
    setupWhatsAppLinks();
    $("#year") && ($("#year").textContent = new Date().getFullYear());
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
    var items = $$(".section__head, .card, .step, .mv-card, .stat, .about__media, .about__body, .testimonial, .accordion, .contact-form, .contact-info");
    if (!items.length) return;

    items.forEach(function (el) { el.classList.add("reveal"); });

    if (!("IntersectionObserver" in window) || prefersReduced) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: .12 });

    items.forEach(function (el) { observer.observe(el); });
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
      teléfono: { req: true, tel: true, msg: "Escribe un teléfono válido (min. 9 digitos)." },
      servicio: { req: true, msg: "Selecciona un servicio." },
      mensaje:  { req: true, min: 10, msg: "Cuentanos un poco mas (min. 10 caracteres)." }
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

      // Envío al servicio externo (Formspree u otro con el mismo formato)
      status.textContent = "Enviando...";
      status.className = "form-status";

      // Si no se ha configurado el endpoint, avisamos en vez de fallar en silencio.
      if (FORM_ENDPOINT.indexOf("TU_ID") !== -1) {
        status.textContent = "Formulario no configurado: sustituye TU_ID en js/main.js y en el action del formulario.";
        status.className = "form-status is-error";
        return;
      }

      fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Accept": "application/json" },
        body: new FormData(form)
      })
        .then(function (res) {
          if (!res.ok) throw new Error("Error de red");
          status.textContent = "Gracias, hemos recibido tu mensaje. Te responderemos en menos de 24 horas laborables.";
          status.className = "form-status is-success";
          form.reset();
        })
        .catch(function () {
          status.textContent = "No se pudo enviar. Intentalo de nuevo o escribenos por WhatsApp.";
          status.className = "form-status is-error";
        });
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
})();
