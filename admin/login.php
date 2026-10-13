<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  LOGIN DEL PANEL  ->  /admin/login.php
 *  Incluye inicio de sesion con correo, alta de cuenta y Google.
 * ============================================================================
 */

require_once __DIR__ . '/../app/bootstrap.php';

// Si ya hay sesion, vamos al panel.
if (is_logged_in()) {
    header('Location: ' . url('admin/'));
    exit;
}

$csrf   = csrf_token();
$notice = '';

// Mensajes de estado que llegan por la URL (tras registro/recuperacion).
$status = $_GET['status'] ?? '';
if ($status === 'registered') {
    $notice = ['ok', 'Cuenta creada. Revisa tu correo para verificarla.'];
} elseif ($status === 'verified') {
    $notice = ['ok', 'Correo verificado. Ya puedes iniciar sesión.'];
}
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Iniciar sesión · Panel · <?= e(config('site_name')) ?></title>
  <link rel="stylesheet" href="<?= e(url('admin/assets/admin.css')) ?>">
</head>
<body>
<div class="auth">
  <form id="loginForm" method="post" action="<?= e(url('api/auth.php?action=login')) ?>">
    <h1>Iniciar sesión</h1>
    <?php if ($notice): ?>
      <div class="alert alert--<?= e($notice[0]) ?>"><?= e($notice[1]) ?></div>
    <?php endif; ?>
    <div class="alert alert--error" id="loginError" hidden></div>

    <input type="hidden" name="_csrf" value="<?= e($csrf) ?>">
    <div class="field">
      <label for="email">Correo electrónico</label>
      <input type="email" id="email" name="email" autocomplete="email" required>
    </div>
    <div class="field">
      <label for="password">Contraseña</label>
      <input type="password" id="password" name="password" autocomplete="current-password" required>
    </div>
    <button class="btn" type="submit" style="width:100%">Entrar</button>

    <?php if (google_enabled()): ?>
      <div class="sep">o</div>
      <a class="btn-google" href="<?= e(url('api/auth.php?action=google_start')) ?>">
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" width="18" height="18">
        Continuar con Google
      </a>
    <?php endif; ?>

    <div class="links">
      <a href="<?= e(url('admin/register.php')) ?>">Crear una cuenta</a> ·
      <a href="<?= e(url('admin/forgot.php')) ?>">Olvidé mi contraseña</a>
    </div>
  </form>
</div>

<script>
document.getElementById('loginForm').addEventListener('submit', async function (ev) {
  ev.preventDefault();
  var form = ev.target;
  var err  = document.getElementById('loginError');
  err.hidden = true;
  try {
    var res  = await fetch(form.action, { method: 'POST', body: new FormData(form) });
    var data = await res.json();
    if (data.ok) { window.location.href = '<?= e(url('admin/')) ?>'; return; }
    err.textContent = data.error || 'No se pudo iniciar sesión.';
    err.hidden = false;
  } catch (e) {
    err.textContent = 'Error de conexión. Inténtalo de nuevo.';
    err.hidden = false;
  }
});
</script>
</body>
</html>
