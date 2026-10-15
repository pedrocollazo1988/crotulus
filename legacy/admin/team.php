<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  PANEL · EQUIPO  ->  /admin/team.php
 *  Crea, edita y publica los miembros del equipo.
 *  La web publica los consume via /api/index.php?resource=team
 * ============================================================================
 */
require_once __DIR__ . '/bootstrap.php';
require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$flash  = null;

if ($method === 'POST') {
    if (!csrf_verify($_POST['_csrf'] ?? null)) {
        $flash = ['error', 'Token de seguridad inválido.'];
    } else {
        $do = (string) ($_POST['do'] ?? '');
        $id = (int) ($_POST['id'] ?? 0);

        if ($do === 'save') {
            $payload = [
                'name'       => limit_text((string) ($_POST['name'] ?? ''), 200),
                'role'       => limit_text((string) ($_POST['role'] ?? ''), 200),
                'bio'        => clean_text((string) ($_POST['bio'] ?? '')),
                'email'      => limit_text((string) ($_POST['email'] ?? ''), 200),
                'phone'      => limit_text((string) ($_POST['phone'] ?? ''), 40),
                'avatar'     => limit_text((string) ($_POST['avatar'] ?? ''), 255),
                'meta'       => json_encode([
                    'linkedin' => limit_text((string) ($_POST['linkedin'] ?? ''), 255),
                ], JSON_UNESCAPED_UNICODE),
                'sort_order' => (int) ($_POST['sort_order'] ?? 0),
                'is_active'  => isset($_POST['is_active']) ? 1 : 0,
                'updated_at' => date('Y-m-d H:i:s'),
            ];
            if ($id > 0) {
                db_update('team_members', $payload, 'id = :id', ['id' => $id]);
            } else {
                $payload['created_at'] = date('Y-m-d H:i:s');
                db_insert('team_members', $payload);
            }
            $flash = ['ok', 'Miembro guardado.'];
        } elseif ($id > 0 && $do === 'borrar') {
            db_query('DELETE FROM team_members WHERE id = ?', [$id]);
            $flash = ['ok', 'Miembro eliminado.'];
        } elseif ($id > 0 && ($do === 'mostrar' || $do === 'ocultar')) {
            db_update('team_members', [
                'is_active'  => $do === 'mostrar' ? 1 : 0,
                'updated_at' => date('Y-m-d H:i:s'),
            ], 'id = :id', ['id' => $id]);
            $flash = ['ok', $do === 'mostrar' ? 'Miembro visible.' : 'Miembro oculto.'];
        }
    }
}

$items = db_all('SELECT * FROM team_members ORDER BY sort_order ASC, id ASC');

// Miembro en edicion (por ?edit=ID).
$edit = null;
if (!empty($_GET['edit'])) {
    $edit = db_one('SELECT * FROM team_members WHERE id = ?', [(int) $_GET['edit']]);
}
$editMeta = $edit && $edit['meta'] ? json_decode((string) $edit['meta'], true) : [];

admin_header('Equipo', true, 'Equipo');
?>
<h1>Equipo</h1>

<?php if ($flash): ?>
  <div class="alert alert--<?= e($flash[0]) ?>"><?= e($flash[1]) ?></div>
<?php endif; ?>

<p class="muted">
  Las personas visibles aparecen en la sección «Equipo» de la web. El avatar es
  una ruta a una imagen (por ejemplo <code>assets/img/equipo/nombre.svg</code>).
</p>

<!-- Formulario de alta/edicion -->
<form method="post" action="<?= e(url('admin/team.php')) ?>">
  <h2><?= $edit ? 'Editar miembro #' . (int) $edit['id'] : 'Añadir miembro' ?></h2>
  <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
  <input type="hidden" name="do" value="save">
  <input type="hidden" name="id" value="<?= $edit ? (int) $edit['id'] : 0 ?>">

  <div class="grid-2">
    <div class="field">
      <label for="name">Nombre</label>
      <input type="text" id="name" name="name" value="<?= e((string) ($edit['name'] ?? '')) ?>" required>
    </div>
    <div class="field">
      <label for="role">Cargo</label>
      <input type="text" id="role" name="role" value="<?= e((string) ($edit['role'] ?? '')) ?>">
    </div>
    <div class="field">
      <label for="email">Correo</label>
      <input type="email" id="email" name="email" value="<?= e((string) ($edit['email'] ?? '')) ?>">
    </div>
    <div class="field">
      <label for="phone">Teléfono</label>
      <input type="tel" id="phone" name="phone" value="<?= e((string) ($edit['phone'] ?? '')) ?>">
    </div>
    <div class="field">
      <label for="avatar">Avatar (ruta)</label>
      <input type="text" id="avatar" name="avatar" value="<?= e((string) ($edit['avatar'] ?? '')) ?>"
             placeholder="assets/img/equipo/...">
    </div>
    <div class="field">
      <label for="linkedin">LinkedIn (URL)</label>
      <input type="url" id="linkedin" name="linkedin" value="<?= e((string) ($editMeta['linkedin'] ?? '')) ?>">
    </div>
    <div class="field">
      <label for="sort_order">Orden</label>
      <input type="text" id="sort_order" name="sort_order" inputmode="numeric"
             value="<?= e((string) ($edit['sort_order'] ?? 0)) ?>">
    </div>
  </div>

  <div class="field">
    <label for="bio">Biografía corta</label>
    <textarea id="bio" name="bio" rows="3"><?= e((string) ($edit['bio'] ?? '')) ?></textarea>
  </div>
  <div class="field">
    <label><input type="checkbox" name="is_active" value="1" <?= (!$edit || (int) $edit['is_active'] === 1) ? 'checked' : '' ?>> Visible en la web</label>
  </div>

  <button class="btn" type="submit">Guardar</button>
  <?php if ($edit): ?><a class="btn btn--ghost" href="<?= e(url('admin/team.php')) ?>">Cancelar</a><?php endif; ?>
</form>

<h2>Miembros (<?= count($items) ?>)</h2>
<?php if (!$items): ?>
  <div class="alert alert--info">Todavía no hay miembros.</div>
<?php else: ?>
<div class="table-wrap">
  <table>
    <thead><tr><th>ID</th><th>Nombre</th><th>Cargo</th><th>Orden</th><th>Estado</th><th>Acciones</th></tr></thead>
    <tbody>
    <?php foreach ($items as $it): ?>
      <tr>
        <td><?= (int) $it['id'] ?></td>
        <td><?= e($it['name']) ?></td>
        <td><?= e($it['role']) ?></td>
        <td><?= (int) $it['sort_order'] ?></td>
        <td><?= (int) $it['is_active'] === 1 ? 'Visible' : 'Oculto' ?></td>
        <td>
          <div class="actions">
            <a class="btn btn--ghost btn--sm" href="<?= e(url('admin/team.php?edit=' . (int) $it['id'])) ?>">Editar</a>
            <form method="post" class="inline">
              <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
              <input type="hidden" name="id" value="<?= (int) $it['id'] ?>">
              <input type="hidden" name="do" value="<?= (int) $it['is_active'] === 1 ? 'ocultar' : 'mostrar' ?>">
              <button class="btn btn--ghost btn--sm" type="submit"><?= (int) $it['is_active'] === 1 ? 'Ocultar' : 'Mostrar' ?></button>
            </form>
            <form method="post" class="inline" onsubmit="return confirm('¿Eliminar este miembro?');">
              <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
              <input type="hidden" name="id" value="<?= (int) $it['id'] ?>">
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
