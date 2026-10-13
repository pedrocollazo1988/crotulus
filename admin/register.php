<?php
declare(strict_types=1);

/**
 *  ALTA DE CUENTA  ->  /admin/register.php
 */
require_once __DIR__ . '/../app/bootstrap.php';

if (is_logged_in()) {
    header('Location: ' . url('admin/'));
    exit;
}
$csrf = csrf_token();
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Crear cuenta · <?= e(config('site_name')) ?></title>
  <link rel="stylesheet" href="<?= e(url('admin/assets/admin.css')) ?>">
</head>
<body>
<div class="auth">
  <form id="registerForm" method="post" action="<?= e(url('api/auth.php?action=register')) ?>">
    <h1>Crear cuenta</h1>
    <div class="alert alert--error" id="regError" hidden></div>
    <div class="alert alert--info">
      La contraseña debe tener al menos <?= (int) config('security.password_min', 8) ?> caracteres,
      una letra y un número.
    </div>

    <input type="hidden" name="_csrf" value="<?= e($csrf) ?>">
    <div class="field">
      <label for="name">Nombre y apellidos</label>
      <input type="text" id="name" name="name" autocomplete="name" required>
    </div>
    <div class="field">
      <label for="email">Correo electrónico</label>
      <input type="email" id="email" name="email" autocomplete="email" required>
    </div>
    <div class="field">
      <label for="password">Contraseña</label>
      <input type="password" id="password" name="password" autocomplete="new-password" required>
    </div>
    <button class="btn" type="submit" style="width:100%">Crear cuenta</button>

    <?php if (google_enabled()): ?>
      <div class="sep">o</div>
      <a class="btn-google" href="<?= e(url('api/auth.php?action=google_start')) ?>">Continuar con Google</a>
    <?php endif; ?>

    <div class="links">¿Ya tienes cuenta? <a href="<?= e(url('admin/login.php')) ?>">Inicia sesión</a></div>
  </form>
</div>

<script>
document.getElementById('registerForm').addEventListener('submit', async function (ev) {
  ev.preventDefault();
  var form = ev.target;
  var err  = document.getElementById('regError');
  err.hidden = true;
  try {
    var res  = await fetch(form.action, { method: 'POST', body: new FormData(form) });
    var data = await res.json();
    if (data.ok) { window.location.href = '<?= e(url('admin/login.php?status=registered')) ?>'; return; }
    err.textContent = data.error || 'No se pudo crear la cuenta.';
    err.hidden = false;
  } catch (e) {
    err.textContent = 'Error de conexión. Inténtalo de nuevo.';
    err.hidden = false;
  }
});
</script>
</body>
</html>
