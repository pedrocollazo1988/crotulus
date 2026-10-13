<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  PANEL · BANDEJA DE MENSAJES  ->  /admin/index.php
 *  Lista los mensajes del formulario, permite marcarlos y borrarlos.
 * ============================================================================
 */
require_once __DIR__ . '/bootstrap.php';
require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$flash  = null;

/* --- Acciones (con CSRF) -------------------------------------------------- */
if ($method === 'POST') {
    if (!csrf_verify($_POST['_csrf'] ?? null)) {
        $flash = ['error', 'Token de seguridad inválido.'];
    } else {
        $id     = (int) ($_POST['id'] ?? 0);
        $action = (string) ($_POST['do'] ?? '');
        if ($id > 0 && in_array($action, ['no_leido', 'leido', 'archivado'], true)) {
            $map = ['no_leido' => 'nuevo', 'leido' => 'leido', 'archivado' => 'archivado'];
            db_update('contact_messages', ['status' => $map[$action]], 'id = :id', ['id' => $id]);
            $flash = ['ok', 'Mensaje actualizado.'];
        } elseif ($id > 0 && $action === 'borrar') {
            db_query('DELETE FROM contact_messages WHERE id = ?', [$id]);
            $flash = ['ok', 'Mensaje eliminado.'];
        }
    }
}

/* --- Datos ---------------------------------------------------------------- */
$total    = (int) (db_one('SELECT COUNT(*) AS c FROM contact_messages')['c'] ?? 0);
$nuevos   = (int) (db_one("SELECT COUNT(*) AS c FROM contact_messages WHERE status = 'nuevo'")['c'] ?? 0);
$usuarios = (int) (db_one('SELECT COUNT(*) AS c FROM users')['c'] ?? 0);
$mensajes = db_all('SELECT * FROM contact_messages ORDER BY created_at DESC, id DESC LIMIT 200');

admin_header('Mensajes', true, 'Mensajes');
?>
<h1>Mensajes de contacto</h1>

<?php if ($flash): ?>
  <div class="alert alert--<?= e($flash[0]) ?>"><?= e($flash[1]) ?></div>
<?php endif; ?>

<div class="cards">
  <div class="stat"><div class="stat__num"><?= $nuevos ?></div><div class="stat__label">Mensajes nuevos</div></div>
  <div class="stat"><div class="stat__num"><?= $total ?></div><div class="stat__label">Mensajes totales</div></div>
  <div class="stat"><div class="stat__num"><?= $usuarios ?></div><div class="stat__label">Usuarios registrados</div></div>
  <div class="stat"><div class="stat__num"><?= e(db_driver()) ?></div><div class="stat__label">Base de datos</div></div>
</div>

<h2>Bandeja de entrada</h2>
<?php if (!$mensajes): ?>
  <div class="alert alert--info">Todavía no hay mensajes.</div>
<?php else: ?>
<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>Fecha</th><th>Nombre</th><th>Contacto</th><th>Servicio</th>
        <th>Mensaje</th><th>Estado</th><th>Acciones</th>
      </tr>
    </thead>
    <tbody>
    <?php foreach ($mensajes as $m): ?>
      <tr>
        <td class="muted"><?= e(date('d/m/Y H:i', strtotime((string) $m['created_at']))) ?></td>
        <td><?= e($m['name']) ?></td>
        <td>
          <a href="mailto:<?= e($m['email']) ?>"><?= e($m['email']) ?></a><br>
          <span class="muted"><?= e($m['phone']) ?></span>
        </td>
        <td><?= e($m['service']) ?></td>
        <td><?= nl2br(e(mb_substr((string) $m['message'], 0, 300))) ?></td>
        <td><span class="badge badge--<?= e($m['status'] === 'nuevo' ? 'nuevo' : ($m['status'] === 'leido' ? 'leido' : 'archivado')) ?>"><?= e($m['status']) ?></span></td>
        <td>
          <div class="actions">
            <?php foreach (['leido' => 'Leído', 'archivado' => 'Archivar', 'no_leido' => 'Nuevo'] as $do => $label): ?>
              <form method="post" class="inline">
                <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
                <input type="hidden" name="id" value="<?= (int) $m['id'] ?>">
                <input type="hidden" name="do" value="<?= e($do) ?>">
                <button class="btn btn--ghost btn--sm" type="submit"><?= e($label) ?></button>
              </form>
            <?php endforeach; ?>
            <form method="post" class="inline" onsubmit="return confirm('¿Eliminar este mensaje?');">
              <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
              <input type="hidden" name="id" value="<?= (int) $m['id'] ?>">
              <input type="hidden" name="do" value="borrar">
              <button class="btn btn--danger btn--sm" type="submit">Borrar</button>
            </form>
          </div>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php endif; ?>
<?php admin_footer(); ?>
