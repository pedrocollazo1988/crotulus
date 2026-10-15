<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  RESTABLECER CONTRASENA  ->  /admin/reset.php?token=...
 *  Muestra el formulario y procesa el cambio (valida token y CSRF).
 * ============================================================================
 */

require_once __DIR__ . '/bootstrap.php';

$token = (string) ($_GET['token'] ?? $_POST['token'] ?? '');
$csrf  = csrf_token();
$error = '';
$done  = false;
$min   = (int) config('security.password_min', 8);

// Validamos el token antes de mostrar el formulario.
$user = $token !== '' ? db_one(
    'SELECT u.* FROM tokens t JOIN users u ON u.id = t.user_id
     WHERE t.type = ? AND t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > ?',
    ['password_reset', token_hash($token), date('Y-m-d H:i:s')]
) : null;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    if (!csrf_verify($_POST['_csrf'] ?? null)) {
        $error = 'Token de seguridad inválido. Recarga la página.';
    } elseif (!$user) {
        $error = 'El enlace ha caducado o ya se ha usado.';
    } else {
        $pass  = (string) ($_POST['password'] ?? '');
        $pass2 = (string) ($_POST['password2'] ?? '');
        $errs  = validate_password($pass);
        if ($errs) {
            $error = implode(' ', $errs);
        } elseif ($pass !== $pass2) {
            $error = 'Las contraseñas no coinciden.';
        } else {
            db_update('users', [
                'password_hash'     => hash_password($pass),
                'email_verified_at' => $user['email_verified_at'] ?: date('Y-m-d H:i:s'),
                'status'            => $user['status'] === 'pending' ? 'active' : $user['status'],
                'updated_at'        => date('Y-m-d H:i:s'),
            ], 'id = :id', ['id' => (int) $user['id']]);

            // Consume el token y revoca todas las sesiones activas.
            db_update('tokens', ['used_at' => date('Y-m-d H:i:s')], 'type = :t AND user_id = :u AND used_at IS NULL', [
                't' => 'password_reset', 'u' => (int) $user['id'],
            ]);
            db_update('sessions', ['revoked_at' => date('Y-m-d H:i:s')], 'user_id = :u AND revoked_at IS NULL', [
                'u' => (int) $user['id'],
            ]);
            audit('password_reset', ['id' => (int) $user['id']]);
            $done = true;
        }
    }
}

admin_auth_page('Nueva contraseña', '<li>Elige una contraseña segura</li><li>Se cerrarán las sesiones abiertas</li><li>Podrás entrar con la nueva al instante</li>');
?>
<?php if ($done): ?>
  <div class="alert alert--ok" role="status">Contraseña actualizada correctamente.</div>
  <p style="text-align:center"><a class="btn" href="<?= e(url('admin/login.php?status=reset')) ?>">Iniciar sesión</a></p>
<?php elseif (!$user): ?>
  <div class="alert alert--error" role="alert">El enlace de recuperación no es válido o ha caducado.</div>
  <p style="text-align:center"><a class="btn btn--ghost" href="<?= e(url('admin/forgot.php')) ?>">Pedir un enlace nuevo</a></p>
<?php else: ?>
  <form id="resetForm" class="js-auth-form" method="post" novalidate action="<?= e(url('admin/reset.php')) ?>">
    <h1>Nueva contraseña</h1>
    <?php if ($error): ?><div class="alert alert--error" role="alert"><?= e($error) ?></div><?php endif; ?>
    <input type="hidden" name="_csrf" value="<?= e($csrf) ?>">
    <input type="hidden" name="token" value="<?= e($token) ?>">

    <div class="field">
      <label for="password">Contraseña nueva</label>
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

    <div class="field">
      <label for="password2">Repite la contraseña</label>
      <input type="password" id="password2" name="password2" data-validate="password2"
             autocomplete="new-password" required>
      <?= field_error_span('password2') ?>
    </div>

    <button class="btn btn--block" type="submit">Guardar contraseña</button>
    <div class="links"><a href="<?= e(url('admin/login.php')) ?>">Volver al inicio de sesión</a></div>
  </form>
<?php endif; ?>
<?php admin_auth_footer(); ?>
