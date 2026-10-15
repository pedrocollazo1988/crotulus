<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  OLVIDE MI CONTRASENA  ->  /admin/forgot.php
 *  Solicita un enlace de recuperacion. Por seguridad, la respuesta es la
 *  misma exista o no la cuenta (evita descubrir correos registrados).
 * ============================================================================
 */

require_once __DIR__ . '/bootstrap.php';
$csrf = csrf_token();

admin_auth_page('Recuperar contraseña', '<li>Te enviamos un enlace seguro</li><li>Válido durante una hora</li><li>Al cambiarla, se cierran las sesiones abiertas</li>');
?>
  <form id="forgotForm" class="js-auth-form" method="post" novalidate
        action="<?= e(url('api/auth.php?action=forgot')) ?>">
    <h1>Recuperar contraseña</h1>
    <p class="muted">Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.</p>

    <div class="alert alert--ok" id="forgotOk" role="status" hidden></div>
    <div class="alert alert--error" id="forgotError" role="alert" hidden></div>
    <input type="hidden" name="_csrf" value="<?= e($csrf) ?>">

    <div class="field">
      <label for="email">Tu correo electrónico</label>
      <input type="email" id="email" name="email" data-validate="email"
             autocomplete="email" inputmode="email" required
             placeholder="nombre@dominio.com">
      <?= field_error_span('email') ?>
    </div>

    <button class="btn btn--block" type="submit">Enviar enlace</button>

    <div class="links">
      <a href="<?= e(url('admin/login.php')) ?>">Volver al inicio de sesión</a>
      <span aria-hidden="true">·</span>
      <a href="<?= e(url('admin/register.php')) ?>">Crear una cuenta</a>
    </div>
  </form>
<?php admin_auth_footer(); ?>
