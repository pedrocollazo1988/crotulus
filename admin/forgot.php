<?php
declare(strict_types=1);

/**
 *  RECUPERAR CONTRASEÑA (solicitar enlace)  ->  /admin/forgot.php
 */
require_once __DIR__ . '/../app/bootstrap.php';
$csrf = csrf_token();
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Recuperar contraseña · <?= e(config('site_name')) ?></title>
  <link rel="stylesheet" href="<?= e(url('admin/assets/admin.css')) ?>">
</head>
<body>
<div class="auth">
  <form id="forgotForm" method="post" action="<?= e(url('api/auth.php?action=forgot')) ?>">
    <h1>Recuperar contraseña</h1>
    <div class="alert alert--ok" id="forgotOk" hidden></div>
    <div class="alert alert--error" id="forgotError" hidden></div>
    <input type="hidden" name="_csrf" value="<?= e($csrf) ?>">
    <div class="field">
      <label for="email">Tu correo electrónico</label>
      <input type="email" id="email" name="email" autocomplete="email" required>
    </div>
    <button class="btn" type="submit" style="width:100%">Enviar enlace</button>
    <div class="links"><a href="<?= e(url('admin/login.php')) ?>">Volver al inicio de sesión</a></div>
  </form>
</div>

<script>
document.getElementById('forgotForm').addEventListener('submit', async function (ev) {
  ev.preventDefault();
  var form = ev.target;
  var ok = document.getElementById('forgotOk');
  var err = document.getElementById('forgotError');
  ok.hidden = true; err.hidden = true;
  try {
    var res  = await fetch(form.action, { method: 'POST', body: new FormData(form) });
    var data = await res.json();
    if (data.ok) { ok.textContent = data.message; ok.hidden = false; form.reset(); return; }
    err.textContent = data.error || 'No se pudo enviar el enlace.';
    err.hidden = false;
  } catch (e) {
    err.textContent = 'Error de conexión. Inténtalo de nuevo.';
    err.hidden = false;
  }
});
</script>
</body>
</html>
