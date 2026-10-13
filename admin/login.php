<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  INICIAR SESION  ->  /admin/login.php
 *  Acceso con correo y contrasena, alta de cuenta y acceso con Google.
 * ============================================================================
 */

require_once __DIR__ . '/bootstrap.php';

// Si ya hay sesion, vamos directamente al panel.
if (is_logged_in()) {
    header('Location: ' . url('admin/'));
    exit;
}

$csrf = csrf_token();

// Mensajes de estado que llegan por la URL (tras registro o verificacion).
$notice = '';
$status = $_GET['status'] ?? '';
if ($status === 'registered') {
    $notice = ['ok', 'Cuenta creada. Revisa tu correo para verificarla.'];
} elseif ($status === 'verified') {
    $notice = ['ok', 'Correo verificado. Ya puedes iniciar sesión.'];
} elseif ($status === 'reset') {
    $notice = ['ok', 'Contraseña actualizada. Inicia sesión con la nueva.'];
} elseif ($status === 'google_off') {
    $notice = ['info', 'El acceso con Google aún no está configurado. Un administrador debe añadir el Client ID y el Client secret en Ajustes.'];
}

admin_auth_page('Iniciar sesión', '<li>Gestiona mensajes y contenido del sitio</li><li>Acceso protegido con doble validación</li><li>Disponible para el equipo de C-ROTULUS</li>');
?>
  <?php if ($notice): ?>
    <div class="alert alert--<?= e($notice[0]) ?>"><?= e($notice[1]) ?></div>
  <?php endif; ?>

  <form id="loginForm" class="js-auth-form" method="post" novalidate
        action="<?= e(url('api/auth.php?action=login')) ?>"
        data-success-url="<?= e(url('admin/')) ?>">
    <h1>Iniciar sesión</h1>
    <div class="alert alert--error" id="loginError" role="alert" hidden></div>
    <input type="hidden" name="_csrf" value="<?= e($csrf) ?>">

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
             autocomplete="current-password" required
             data-min="<?= (int) config('security.password_min', 8) ?>">
      <?= field_error_span('password') ?>
    </div>

    <button class="btn btn--block" type="submit">Entrar</button>

    <?php if (google_enabled()): ?>
      <div class="sep">o</div>
      <a class="btn-google" href="<?= e(url('api/auth.php?action=google_start')) ?>"
         data-google-start data-google-ok="1">
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" width="18" height="18">
        Continuar con Google
      </a>
    <?php else: ?>
      <!-- Google OAuth pendiente de credenciales. El botón responde igualmente:
           muestra un aviso inmediato con los pasos para configurarlo. -->
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
      <a href="<?= e(url('admin/forgot.php')) ?>">Olvidé mi contraseña</a>
      <span aria-hidden="true">·</span>
      <a href="<?= e(url('admin/register.php')) ?>">Crear una cuenta</a>
    </div>
  </form>
<?php admin_auth_footer(); ?>
