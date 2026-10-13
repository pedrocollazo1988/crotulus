<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  PANEL · CONTENIDO  ->  /admin/content.php
 *  Gestiona los elementos editables (servicios, proyectos, testimonios, FAQ).
 *  La web publica los consume via /api/index.php?resource=content
 * ============================================================================
 */
require_once __DIR__ . '/bootstrap.php';
require_admin();

// Tipos de contenido permitidos (lista blanca).
$types = [
    'servicio'    => 'Servicios',
    'proyecto'    => 'Proyectos',
    'testimonio'  => 'Testimonios',
    'faq'         => 'Preguntas frecuentes',
    'proceso'     => 'Cómo trabajamos',
];

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$flash  = null;

if ($method === 'POST') {
    if (!csrf_verify($_POST['_csrf'] ?? null)) {
        $flash = ['error', 'Token de seguridad inválido.'];
    } else {
        $do = (string) ($_POST['do'] ?? '');
        $id = (int) ($_POST['id'] ?? 0);

        if ($do === 'save') {
            $ctype = (string) ($_POST['ctype'] ?? '');
            if (!isset($types[$ctype])) {
                $flash = ['error', 'Tipo de contenido no válido.'];
            } else {
                $payload = [
                    'ctype'      => $ctype,
                    'title'      => limit_text((string) ($_POST['title'] ?? ''), 200),
                    'subtitle'   => limit_text((string) ($_POST['subtitle'] ?? ''), 255),
                    'body'       => clean_text((string) ($_POST['body'] ?? '')),
                    'sort_order' => (int) ($_POST['sort_order'] ?? 0),
                    'is_active'  => isset($_POST['is_active']) ? 1 : 0,
                    'updated_at' => date('Y-m-d H:i:s'),
                ];
                if ($id > 0) {
                    db_update('content_items', $payload, 'id = :id', ['id' => $id]);
                } else {
                    $payload['created_at'] = date('Y-m-d H:i:s');
                    db_insert('content_items', $payload);
                }
                $flash = ['ok', 'Contenido guardado.'];
            }
        } elseif ($id > 0 && $do === 'borrar') {
            db_query('DELETE FROM content_items WHERE id = ?', [$id]);
            $flash = ['ok', 'Elemento eliminado.'];
        }
    }
}

$filter = (string) ($_GET['type'] ?? '');
$filter = isset($types[$filter]) ? $filter : '';

if ($filter) {
    $items = db_all('SELECT * FROM content_items WHERE ctype = ? ORDER BY sort_order ASC, id ASC', [$filter]);
} else {
    $items = db_all('SELECT * FROM content_items ORDER BY ctype ASC, sort_order ASC, id ASC');
}

// Elemento en edicion (por ?edit=ID).
$edit = null;
if (!empty($_GET['edit'])) {
    $edit = db_one('SELECT * FROM content_items WHERE id = ?', [(int) $_GET['edit']]);
}

admin_header('Contenido');
?>
<h1>Contenido editable</h1>

<?php if ($flash): ?>
  <div class="alert alert--<?= e($flash[0]) ?>"><?= e($flash[1]) ?></div>
<?php endif; ?>

<p class="muted">
  Estos elementos se sirven a la web mediante la API. Si no hay datos aquí,
  la web muestra su contenido por defecto.
</p>

<p>
  <a class="btn btn--ghost btn--sm" href="<?= e(url('admin/content.php')) ?>">Todos</a>
  <?php foreach ($types as $key => $label): ?>
    <a class="btn btn--ghost btn--sm" href="<?= e(url('admin/content.php?type=' . $key)) ?>"><?= e($label) ?></a>
  <?php endforeach; ?>
</p>

<!-- Formulario de alta/edicion -->
<form method="post" action="<?= e(url('admin/content.php')) ?>">
  <h2><?= $edit ? 'Editar elemento #' . (int) $edit['id'] : 'Añadir elemento' ?></h2>
  <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
  <input type="hidden" name="do" value="save">
  <input type="hidden" name="id" value="<?= $edit ? (int) $edit['id'] : 0 ?>">

  <div class="grid-2">
    <div class="field">
      <label for="ctype">Tipo</label>
      <select id="ctype" name="ctype" required>
        <?php foreach ($types as $key => $label): ?>
          <option value="<?= e($key) ?>" <?= ($edit && $edit['ctype'] === $key) ? 'selected' : '' ?>><?= e($label) ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    <div class="field">
      <label for="sort_order">Orden</label>
      <input type="text" id="sort_order" name="sort_order" inputmode="numeric"
             value="<?= e((string) ($edit['sort_order'] ?? 0)) ?>">
    </div>
  </div>

  <div class="field">
    <label for="title">Título</label>
    <input type="text" id="title" name="title" value="<?= e((string) ($edit['title'] ?? '')) ?>">
  </div>
  <div class="field">
    <label for="subtitle">Subtítulo / resumen corto</label>
    <input type="text" id="subtitle" name="subtitle" value="<?= e((string) ($edit['subtitle'] ?? '')) ?>">
  </div>
  <div class="field">
    <label for="body">Descripción</label>
    <textarea id="body" name="body" rows="4"><?= e((string) ($edit['body'] ?? '')) ?></textarea>
  </div>
  <div class="field">
    <label><input type="checkbox" name="is_active" value="1" <?= (!$edit || (int) $edit['is_active'] === 1) ? 'checked' : '' ?>> Visible en la web</label>
  </div>

  <button class="btn" type="submit">Guardar</button>
  <?php if ($edit): ?><a class="btn btn--ghost" href="<?= e(url('admin/content.php')) ?>">Cancelar</a><?php endif; ?>
</form>

<h2>Elementos (<?= count($items) ?>)</h2>
<?php if (!$items): ?>
  <div class="alert alert--info">No hay elementos para este filtro.</div>
<?php else: ?>
<div class="table-wrap">
  <table>
    <thead><tr><th>ID</th><th>Tipo</th><th>Título</th><th>Orden</th><th>Activo</th><th>Acciones</th></tr></thead>
    <tbody>
    <?php foreach ($items as $it): ?>
      <tr>
        <td><?= (int) $it['id'] ?></td>
        <td><?= e($types[$it['ctype']] ?? $it['ctype']) ?></td>
        <td><?= e($it['title']) ?><br><span class="muted"><?= e(mb_substr((string) $it['subtitle'], 0, 90)) ?></span></td>
        <td><?= (int) $it['sort_order'] ?></td>
        <td><?= (int) $it['is_active'] === 1 ? 'Sí' : 'No' ?></td>
        <td>
          <div class="actions">
            <a class="btn btn--ghost btn--sm" href="<?= e(url('admin/content.php?edit=' . (int) $it['id'])) ?>">Editar</a>
            <form method="post" class="inline" onsubmit="return confirm('¿Eliminar este elemento?');">
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
