<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  PANEL · USUARIOS  ->  /admin/users.php
 *  Lista las cuentas, permite aprobar/desactivar, cambiar el rol y borrar.
 *  El administrador actual no puede cambiarse el rol ni desactivarse a si mismo.
 * ============================================================================
 */
require_once __DIR__ . '/bootstrap.php';
require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$me     = current_user();
$flash  = null;

if ($method === 'POST') {
    if (!csrf_verify($_POST['_csrf'] ?? null)) {
        $flash = ['error', 'Token de seguridad inválido.'];
    } else {
        $id     = (int) ($_POST['id'] ?? 0);
        $action = (string) ($_POST['do'] ?? '');
        $target = $id > 0 ? db_one('SELECT * FROM users WHERE id = ?', [$id]) : null;

        if (!$target) {
            $flash = ['error', 'Usuario no encontrado.'];
        } elseif ($target['id'] === $me['id'] && in_array($action, ['ban', 'role', 'borrar'], true)) {
            $flash = ['error', 'No puedes cambiar tu propio acceso.'];
        } elseif ($action === 'activar') {
            db_update('users', [
                'status'            => 'active',
                'email_verified_at' => $target['email_verified_at'] ?: date('Y-m-d H:i:s'),
                'updated_at'        => date('Y-m-d H:i:s'),
            ], 'id = :id', ['id' => $id]);
            audit('user_activated', ['id' => $id]);
            $flash = ['ok', 'Cuenta activada.'];
        } elseif ($action === 'ban') {
            db_update('users', ['status' => 'banned', 'updated_at' => date('Y-m-d H:i:s')], 'id = :id', ['id' => $id]);
            // Cierra sus sesiones activas.
            db_update('sessions', ['revoked_at' => date('Y-m-d H:i:s')], 'user_id = :u AND revoked_at IS NULL', ['u' => $id]);
            audit('user_banned', ['id' => $id]);
            $flash = ['ok', 'Cuenta desactivada.'];
        } elseif ($action === 'role') {
            $role = (string) ($_POST['role'] ?? 'user');
            if (in_array($role, ['admin', 'user'], true)) {
                db_update('users', ['role' => $role, 'updated_at' => date('Y-m-d H:i:s')], 'id = :id', ['id' => $id]);
                audit('user_role', ['id' => $id, 'role' => $role]);
                $flash = ['ok', 'Rol actualizado.'];
            }
        } elseif ($action === 'borrar') {
            db_query('DELETE FROM users WHERE id = ?', [$id]);
            db_query('DELETE FROM sessions WHERE user_id = ?', [$id]);
            audit('user_deleted', ['id' => $id]);
            $flash = ['ok', 'Usuario eliminado.'];
        }
    }
}

$total    = (int) (db_one('SELECT COUNT(*) AS c FROM users')['c'] ?? 0);
$activos  = (int) (db_one("SELECT COUNT(*) AS c FROM users WHERE status = 'active'")['c'] ?? 0);
$pendientes = (int) (db_one("SELECT COUNT(*) AS c FROM users WHERE status = 'pending'")['c'] ?? 0);
$admins   = (int) (db_one("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'")['c'] ?? 0);
$usuarios = db_all('SELECT * FROM users ORDER BY created_at DESC, id DESC');

admin_header('Usuarios', true, 'Usuarios');
?>
<h1>Usuarios</h1>

<?php if ($flash): ?>
  <div class="alert alert--<?= e($flash[0]) ?>"><?= e($flash[1]) ?></div>
<?php endif; ?>

<div class="cards">
  <div class="stat"><div class="stat__num"><?= $total ?></div><div class="stat__label">Cuentas totales</div></div>
  <div class="stat"><div class="stat__num"><?= $activos ?></div><div class="stat__label">Cuentas activas</div></div>
  <div class="stat"><div class="stat__num"><?= $pendientes ?></div><div class="stat__label">Pendientes de verificar</div></div>
  <div class="stat"><div class="stat__num"><?= $admins ?></div><div class="stat__label">Administradores</div></div>
</div>

<h2>Listado de cuentas</h2>
<?php if (!$usuarios): ?>
  <div class="alert alert--info">Todavía no hay usuarios registrados.</div>
<?php else: ?>
<div class="table-wrap">
  <table>
    <thead>
      <tr><th>Alta</th><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr>
    </thead>
    <tbody>
    <?php foreach ($usuarios as $u): ?>
      <?php $self = ((int) $u['id'] === (int) $me['id']); ?>
      <tr>
        <td class="muted"><?= $u['created_at'] ? e(date('d/m/Y', strtotime((string) $u['created_at']))) : '—' ?></td>
        <td><?= e($u['name'] ?: '—') ?><?= $self ? ' <span class="muted">(tú)</span>' : '' ?></td>
        <td><a href="mailto:<?= e($u['email']) ?>"><?= e($u['email']) ?></a></td>
        <td><span class="badge badge--<?= $u['role'] === 'admin' ? 'nuevo' : 'leido' ?>"><?= e($u['role']) ?></span></td>
        <td><span class="badge badge--<?= $u['status'] === 'active' ? 'archivado' : 'leido' ?>"><?= e($u['status']) ?></span></td>
        <td>
          <div class="actions">
            <?php if ($u['status'] !== 'active'): ?>
              <form method="post" class="inline"><input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
                <input type="hidden" name="id" value="<?= (int) $u['id'] ?>"><input type="hidden" name="do" value="activar">
                <button class="btn btn--ghost btn--sm" type="submit">Activar</button></form>
            <?php endif; ?>

            <?php if (!$self): ?>
              <form method="post" class="inline"><input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
                <input type="hidden" name="id" value="<?= (int) $u['id'] ?>"><input type="hidden" name="do" value="role">
                <input type="hidden" name="role" value="<?= $u['role'] === 'admin' ? 'user' : 'admin' ?>">
                <button class="btn btn--ghost btn--sm" type="submit"><?= $u['role'] === 'admin' ? 'Quitar admin' : 'Hacer admin' ?></button></form>

              <?php if ($u['status'] !== 'banned'): ?>
                <form method="post" class="inline"><input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
                  <input type="hidden" name="id" value="<?= (int) $u['id'] ?>"><input type="hidden" name="do" value="ban">
                  <button class="btn btn--ghost btn--sm" type="submit">Desactivar</button></form>
              <?php endif; ?>

              <form method="post" class="inline" onsubmit="return confirm('¿Eliminar esta cuenta? Esta acción no se puede deshacer.');">
                <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
                <input type="hidden" name="id" value="<?= (int) $u['id'] ?>"><input type="hidden" name="do" value="borrar">
                <button class="btn btn--danger btn--sm" type="submit">Borrar</button></form>
            <?php else: ?>
              <span class="muted">Sesión actual</span>
            <?php endif; ?>
          </div>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php endif; ?>
<?php admin_footer(); ?>
