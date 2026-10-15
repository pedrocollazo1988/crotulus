<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  CREAR CUENTA  ->  /admin/register.php
 *  El primer usuario registrado se convierte en administrador.
 * ============================================================================
 */

require_once __DIR__ . '/bootstrap.php';

if (is_logged_in()) {
    header('Location: ' . url('admin/'));
    exit;
}

$csrf = csrf_token();
$min  = (int) config('security.password_min', 8);

admin_auth_page('Crear cuenta', '<li>Crea tu cuenta de administrador</li><li>Verificación por correo electrónico</li><li>Acceso con Google disponible</li>');
?>
  <form id="registerForm" class="js-auth-form" method="post" novalidate
        action="<?= e(url('api/auth.php?action=register')) ?>"
        data-success-url="<?= e(url('admin/login.php?status=registered')) ?>">
    <h1>Crear cuenta</h1>
    <div class="alert alert--error" id="regError" role="alert" hidden></div>
    <div class="alert alert--info">
      La contraseña debe tener al menos <?= $min ?> caracteres e incluir una letra y un número.
    </div>
    <input type="hidden" name="_csrf" value="<?= e($csrf) ?>">

    <div class="field">
      <label for="name">Nombre y apellidos</label>
      <input type="text" id="name" name="name" data-validate="name"
             autocomplete="name" required maxlength="120"
             placeholder="Ej.: María López">
      <?= field_error_span('name') ?>
    </div>

    <div class="field">
      <label for="email">Correo electrónico</label>
      <input type="email" id="email" name="email" data-validate="email"
             autocomplete="email" inputmode="email" required
             placeholder="nombre@dominio.com">
      <?= field_error_span('email') ?>
    </div>

    <div class="field">
      <label for="password">Contraseña</label>
      <input type="password" id="password" name="password" data-validate="password"
             autocomplete="new-password" required data-min="<?= $min ?>">
      <div class="strength" data-strength-for="password" data-score="0">
        <div class="strength__bars" aria-hidden="true">
          <span class="strength__bar"></span><span class="strength__bar"></span>
          <span class="strength__bar"></span><span class="strength__bar"></span>
        </div>
        <span class="strength__text" aria-live="polite"></span>
      </div>
      <?= field_error_span('password') ?>
    </div>

    <button class="btn btn--block" type="submit">Crear cuenta</button>

    <?php if (google_enabled()): ?>
      <div class="sep">o</div>
      <a class="btn-google" href="<?= e(url('api/auth.php?action=google_start')) ?>"
         data-google-start data-google-ok="1">
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" width="18" height="18">
        Continuar con Google
      </a>
    <?php else: ?>
      <!-- Google OAuth pendiente de credenciales. El botón responde igualmente. -->
      <div class="sep">o</div>
      <a class="btn-google is-muted" href="<?= e(url('api/auth.php?action=google_start')) ?>"
         data-google-start data-google-off="1"
         title="Añade el Client ID y el Client secret de Google en Ajustes para activarlo">
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" width="18" height="18">
        Continuar con Google
      </a>
    <?php endif; ?>
    <div class="alert alert--info" id="googleNotice" role="status" hidden></div>

    <div class="links">
      ¿Ya tienes cuenta? <a href="<?= e(url('admin/login.php')) ?>">Inicia sesión</a>
    </div>
  </form>
<?php admin_auth_footer(); ?>
