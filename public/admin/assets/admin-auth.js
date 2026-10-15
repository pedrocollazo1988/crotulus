/* ==========================================================================
   FORMULARIOS DE ACCESO · C-ROTULUS
   --------------------------------------------------------------------------
   Un solo archivo para login, registro, "olvide mi contrasena" y reset.
   Responsabilidades:
     1) Validacion en tiempo real (mensajes bajo cada campo + medidor).
     2) Envio por fetch al backend con CSRF y JSON.
     3) Muestra de exito/error sin recargar la pagina.
   Mejora progresiva: si este JS no se ejecuta, el servidor valida igual y los
   formularios siguen enviandose de forma clasica.
   ========================================================================== */
(function () {
  "use strict";

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var MIN_DEFAULT = 8;

  /* ===================== 1. VALIDACION ================================== */

  function fieldBox(input) {
    return input.form && input.form.querySelector('[data-error-for="' + input.id + '"]');
  }

  function setError(input, message) {
    var box = fieldBox(input);
    if (message) {
      input.setAttribute("aria-invalid", "true");
      if (box) { box.textContent = message; box.hidden = false; }
    } else {
      input.removeAttribute("aria-invalid");
      if (box) { box.textContent = ""; box.hidden = true; }
    }
  }

  function minLength(input) {
    var n = parseInt(input.getAttribute("data-min") || "", 10);
    return isNaN(n) ? MIN_DEFAULT : n;
  }

  function validateInput(input) {
    var kind = input.getAttribute("data-validate") || input.type || "text";
    var value = (input.value || "").trim();

    if (input.hasAttribute("required") && value === "") {
      return "Este campo es obligatorio.";
    }
    if (value === "") return "";

    if (kind === "email") {
      if (!EMAIL_RE.test(value)) return "Escribe un correo válido (ejemplo: nombre@dominio.com).";
      if (value.length > 190) return "El correo es demasiado largo.";
    }
    if (kind === "tel") {
      var digits = value.replace(/\D/g, "");
      if (digits.length < 6 || digits.length > 25) return "Escribe un teléfono válido.";
      if (!/^[0-9+\s().\-]+$/.test(value)) return "El teléfono contiene caracteres no válidos.";
    }
    if (kind === "name") {
      if (value.length < 2) return "Escribe tu nombre (mínimo 2 caracteres).";
      if (value.length > 120) return "El nombre es demasiado largo.";
    }
    if (kind === "text") {
      if (value.length < 10) return "Cuéntanos un poco más (mínimo 10 caracteres).";
      if (value.length > 1500) return "El texto es demasiado largo.";
    }
    if (kind === "question") {
      if (value.length < 8) return "Escribe la pregunta (mínimo 8 caracteres).";
      if (value.length > 200) return "La pregunta es demasiado larga.";
    }
    if (kind === "password") {
      var min = minLength(input);
      if (value.length < min) return "La contraseña debe tener al menos " + min + " caracteres.";
      if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(value)) return "Incluye al menos una letra.";
      if (!/\d/.test(value)) return "Incluye al menos un número.";
    }
    if (kind === "password2") {
      var target = input.form.querySelector('input[data-validate="password"]');
      if (target && value !== target.value) return "Las contraseñas no coinciden.";
    }
    return "";
  }

  /* ===================== 2. MEDIDOR DE FUERZA =========================== */

  function scorePassword(value) {
    var score = 0;
    if (value.length >= 8) score++;
    if (value.length >= 12) score++;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
    if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
    return Math.min(score, 4);
  }

  var LABEL = ["", "Débil", "Aceptable", "Buena", "Fuerte"];

  function updateStrength(input) {
    var box = input.form && input.form.querySelector('[data-strength-for="' + input.id + '"]');
    if (!box) return;
    var score = input.value ? Math.max(1, scorePassword(input.value)) : 0;
    box.setAttribute("data-score", String(score));
    var text = box.querySelector(".strength__text");
    if (text) text.textContent = input.value ? "Seguridad: " + LABEL[score] : "";
  }

  /* ===================== 3. ENVIO (fetch + CSRF) ======================== */

  function submitForm(form, okId, errId, onSuccess, errBoxOverride) {
    var okBox = document.getElementById(okId);
    var errBox = errBoxOverride || document.getElementById(errId);
    var btn = form.querySelector('button[type="submit"]');
    if (okBox) okBox.hidden = true;
    if (errBox) errBox.hidden = true;

    var original = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }

    fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { "X-Requested-With": "XMLHttpRequest" }
    })
      .then(function (res) { return res.json().catch(function () { return { ok: false }; }); })
      .then(function (data) {
        if (btn) { btn.disabled = false; btn.textContent = original; }

        if (data && data.ok) {
          if (onSuccess) { onSuccess(data); return; }
          if (okBox) { okBox.textContent = data.message || "Hecho."; okBox.hidden = false; }
          form.reset();
          return;
        }

        // Errores por campo del servidor (si vienen) + error general.
        if (data && data.fields) {
          Object.keys(data.fields).forEach(function (name) {
            var input = form.querySelector('[name="' + name + '"]');
            if (input) setError(input, String(data.fields[name]));
          });
        }
        if (errBox) {
          errBox.textContent = (data && data.error) || "No se pudo completar la operación.";
          errBox.hidden = false;
        }
      })
      .catch(function () {
        if (btn) { btn.disabled = false; btn.textContent = original; }
        if (errBox) { errBox.textContent = "Error de conexión. Inténtalo de nuevo."; errBox.hidden = false; }
      });
  }

  /* ===================== 4. CONEXION DE CADA FORMULARIO ================= */

  function setupValidation(form) {
    var fields = Array.prototype.slice.call(form.querySelectorAll("[data-validate], input[required]"));
    fields.forEach(function (input) {
      var run = function () { setError(input, validateInput(input)); };

      input.addEventListener("blur", run);
      input.addEventListener("input", function () {
        if (input.getAttribute("aria-invalid") === "true") run();
        if (input.getAttribute("data-validate") === "password") updateStrength(input);
      });

      // Al cambiar la contrasena, revalida la repeticion si ya tiene valor.
      if (input.getAttribute("data-validate") === "password") {
        input.addEventListener("input", function () {
          var repeat = form.querySelector('input[data-validate="password2"]');
          if (repeat && repeat.value) setError(repeat, validateInput(repeat));
        });
      }
    });
  }

  function validateAll(form) {
    var fields = Array.prototype.slice.call(form.querySelectorAll("[data-validate], input[required]"));
    var firstInvalid = null;
    fields.forEach(function (input) {
      var err = validateInput(input);
      setError(input, err);
      if (err && !firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) { firstInvalid.focus(); return false; }
    return true;
  }

  function init() {
    /* --- Boton "Mostrar/Ocultar" contrasena ---
       Evita el fallo mas comun al iniciar sesion: no ver que se ha tecleado
       (mayusculas, guion, espacios del autocompletado...). */
    document.querySelectorAll("[data-pw-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var input = document.getElementById(btn.getAttribute("data-pw-toggle") || "");
        if (!input) return;
        var show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.textContent = show ? "Ocultar" : "Mostrar";
        btn.setAttribute("aria-label", (show ? "Ocultar" : "Mostrar") + " contraseña");
        btn.setAttribute("aria-pressed", show ? "true" : "false");
      });
    });

    /* --- Botón "Continuar con Google" ---
       Sin credenciales configuradas, el enlace volvía a la misma pantalla y
       parecía no responder. Ahora mostramos un aviso inmediato y comprobamos
       si Google está listo antes de redirigir. */
    document.querySelectorAll("[data-google-start]").forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        var box = document.getElementById("googleNotice");
        if (btn.hasAttribute("data-google-off")) {
          ev.preventDefault();
          if (box) {
            box.hidden = false;
            box.textContent = "El acceso con Google aún no está activado. Un administrador debe añadir el Client ID y el Client secret en Ajustes · Google.";
          }
          return;
        }
        // Configurado: confirmamos con un pequeño aviso antes de salir a Google.
        if (box) {
          box.hidden = false;
          box.textContent = "Abriendo el acceso con Google…";
        }
      });
    });

    /* --- Login --- */
    var login = document.getElementById("loginForm");
    if (login) {
      setupValidation(login);
      login.addEventListener("submit", function (ev) {
        ev.preventDefault();
        if (!validateAll(login)) return;
        submitForm(login, null, "loginError", function (data) {
          // Según el rol: administradores al panel; el resto, a su área privada.
          var role = data && data.user && data.user.role;
          window.location.href = (role === "admin")
            ? (login.getAttribute("data-admin-url") || "admin/")
            : (login.getAttribute("data-success-url") || "admin/account");
        });
      });
    }

    /* --- Registro --- */
    var reg = document.getElementById("registerForm");
    if (reg) {
      setupValidation(reg);
      reg.addEventListener("submit", function (ev) {
        ev.preventDefault();
        if (!validateAll(reg)) return;
        submitForm(reg, null, "regError", function () {
          window.location.href = reg.getAttribute("data-success-url") || "/admin/login?status=registered";
        });
      });
    }

    /* --- Olvide mi contrasena --- */
    var forgot = document.getElementById("forgotForm");
    if (forgot) {
      setupValidation(forgot);
      forgot.addEventListener("submit", function (ev) {
        ev.preventDefault();
        if (!validateAll(forgot)) return;
        submitForm(forgot, "forgotOk", "forgotError");
      });
    }

    /* --- Reset (nueva contrasena) --- */
    var reset = document.getElementById("resetForm");
    if (reset) {
      setupValidation(reset);
      reset.addEventListener("submit", function (ev) {
        if (!validateAll(reset)) ev.preventDefault();
      });
    }

    /* --- Aportaciones del área privada (Mi cuenta) ---
       Testimonios y preguntas. Envío por fetch con CSRF; el servidor valida y
       responde JSON. Los avisos se muestran en la propia tarjeta. */
    Array.prototype.slice.call(document.querySelectorAll(".js-account-form")).forEach(function (form) {
      setupValidation(form);
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        if (!validateAll(form)) return;
        var okBox  = form.querySelector("[data-account-ok]");
        var errBox = form.querySelector("[data-account-error]");
        if (okBox) okBox.hidden = true;
        if (errBox) errBox.hidden = true;
        submitForm(form, null, null, function (data) {
          if (okBox) { okBox.textContent = (data && data.message) || "Enviado."; okBox.hidden = false; }
          form.reset();
          setTimeout(function () { window.location.reload(); }, 1200);
        }, errBox);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
