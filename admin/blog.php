<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  PANEL · BLOG  ->  /admin/blog.php
 *  Crea, edita y publica los articulos del blog.
 *  La web publica los consume via /api/index.php?resource=blog
 * ============================================================================
 */
require_once __DIR__ . '/bootstrap.php';
require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$flash  = null;

/** Convierte un titulo en slug ASCII: "Cómo la IA" -> "como-la-ia". */
function slugify(string $text): string
{
    $text = mb_strtolower(trim($text), 'UTF-8');
    $map  = ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ü'=>'u','ñ'=>'n',
             'à'=>'a','è'=>'e','ì'=>'i','ò'=>'o','ù'=>'u','ç'=>'c'];
    $text = strtr($text, $map);
    $text = preg_replace('/[^a-z0-9]+/', '-', $text) ?? '';
    return trim($text, '-');
}

if ($method === 'POST') {
    if (!csrf_verify($_POST['_csrf'] ?? null)) {
        $flash = ['error', 'Token de seguridad inválido.'];
    } else {
        $do = (string) ($_POST['do'] ?? '');
        $id = (int) ($_POST['id'] ?? 0);

        if ($do === 'save') {
            $title = limit_text((string) ($_POST['title'] ?? ''), 200);
            $slug  = slugify((string) ($_POST['slug'] ?? ''));
            if ($slug === '') {
                $slug = slugify($title);
            }
            $payload = [
                'slug'         => $slug,
                'title'        => $title,
                'excerpt'      => clean_text((string) ($_POST['excerpt'] ?? '')),
                'body'         => clean_text((string) ($_POST['body'] ?? '')),
                'category'     => limit_text((string) ($_POST['category'] ?? ''), 80),
                'author'       => limit_text((string) ($_POST['author'] ?? ''), 200),
                'image'        => limit_text((string) ($_POST['image'] ?? ''), 255),
                'meta'         => json_encode([
                    'reading_minutes' => max(0, min(60, (int) ($_POST['reading_minutes'] ?? 0))),
                ], JSON_UNESCAPED_UNICODE),
                'sort_order'   => (int) ($_POST['sort_order'] ?? 0),
                'is_active'    => isset($_POST['is_active']) ? 1 : 0,
                'updated_at'   => date('Y-m-d H:i:s'),
            ];
            if ($id > 0) {
                db_update('blog_posts', $payload, 'id = :id', ['id' => $id]);
            } else {
                $payload['created_at']   = date('Y-m-d H:i:s');
                $payload['published_at'] = date('Y-m-d H:i:s');
                db_insert('blog_posts', $payload);
            }
            $flash = ['ok', 'Artículo guardado.'];
        } elseif ($id > 0 && $do === 'borrar') {
            db_query('DELETE FROM blog_posts WHERE id = ?', [$id]);
            $flash = ['ok', 'Artículo eliminado.'];
        } elseif ($id > 0 && ($do === 'publicar' || $do === 'ocultar')) {
            db_update('blog_posts', [
                'is_active'  => $do === 'publicar' ? 1 : 0,
                'updated_at' => date('Y-m-d H:i:s'),
            ], 'id = :id', ['id' => $id]);
            $flash = ['ok', $do === 'publicar' ? 'Artículo publicado.' : 'Artículo oculto.'];
        }
    }
}

$items = db_all('SELECT * FROM blog_posts ORDER BY published_at DESC, sort_order ASC, id DESC');

// Articulo en edicion (por ?edit=ID).
$edit = null;
if (!empty($_GET['edit'])) {
    $edit = db_one('SELECT * FROM blog_posts WHERE id = ?', [(int) $_GET['edit']]);
}
$editMeta = $edit && $edit['meta'] ? json_decode((string) $edit['meta'], true) : [];

admin_header('Blog', true, 'Blog');
?>
<h1>Blog</h1>

<?php if ($flash): ?>
  <div class="alert alert--<?= e($flash[0]) ?>"><?= e($flash[1]) ?></div>
<?php endif; ?>

<p class="muted">
  Los artículos publicados aparecen en la sección «Blog» de la web. La portada
  es una ruta a una imagen (por ejemplo <code>assets/img/blog/mi-articulo.svg</code>).
</p>

<!-- Formulario de alta/edicion -->
<form method="post" action="<?= e(url('admin/blog.php')) ?>">
  <h2><?= $edit ? 'Editar artículo #' . (int) $edit['id'] : 'Añadir artículo' ?></h2>
  <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
  <input type="hidden" name="do" value="save">
  <input type="hidden" name="id" value="<?= $edit ? (int) $edit['id'] : 0 ?>">

  <div class="grid-2">
    <div class="field">
      <label for="title">Título</label>
      <input type="text" id="title" name="title" value="<?= e((string) ($edit['title'] ?? '')) ?>" required>
    </div>
    <div class="field">
      <label for="slug">Slug (URL)</label>
      <input type="text" id="slug" name="slug" value="<?= e((string) ($edit['slug'] ?? '')) ?>"
             placeholder="se-genera-del-titulo">
    </div>
    <div class="field">
      <label for="category">Categoría</label>
      <input type="text" id="category" name="category" value="<?= e((string) ($edit['category'] ?? '')) ?>">
    </div>
    <div class="field">
      <label for="author">Autor</label>
      <input type="text" id="author" name="author" value="<?= e((string) ($edit['author'] ?? '')) ?>">
    </div>
    <div class="field">
      <label for="image">Imagen de portada (ruta)</label>
      <input type="text" id="image" name="image" value="<?= e((string) ($edit['image'] ?? '')) ?>"
             placeholder="assets/img/blog/...">
    </div>
    <div class="field">
      <label for="sort_order">Orden</label>
      <input type="text" id="sort_order" name="sort_order" inputmode="numeric"
             value="<?= e((string) ($edit['sort_order'] ?? 0)) ?>">
    </div>
    <div class="field">
      <label for="reading_minutes">Minutos de lectura</label>
      <input type="text" id="reading_minutes" name="reading_minutes" inputmode="numeric"
             value="<?= e((string) ($editMeta['reading_minutes'] ?? 4)) ?>">
    </div>
  </div>

  <div class="field">
    <label for="excerpt">Extracto / resumen</label>
    <textarea id="excerpt" name="excerpt" rows="2"><?= e((string) ($edit['excerpt'] ?? '')) ?></textarea>
  </div>
  <div class="field">
    <label for="body">Contenido</label>
    <textarea id="body" name="body" rows="8"><?= e((string) ($edit['body'] ?? '')) ?></textarea>
  </div>
  <div class="field">
    <label><input type="checkbox" name="is_active" value="1" <?= (!$edit || (int) $edit['is_active'] === 1) ? 'checked' : '' ?>> Publicado</label>
  </div>

  <button class="btn" type="submit">Guardar</button>
  <?php if ($edit): ?><a class="btn btn--ghost" href="<?= e(url('admin/blog.php')) ?>">Cancelar</a><?php endif; ?>
</form>

<h2>Artículos (<?= count($items) ?>)</h2>
<?php if (!$items): ?>
  <div class="alert alert--info">Todavía no hay artículos.</div>
<?php else: ?>
<div class="table-wrap">
  <table>
    <thead><tr><th>ID</th><th>Título</th><th>Categoría</th><th>Publicado</th><th>Estado</th><th>Acciones</th></tr></thead>
    <tbody>
    <?php foreach ($items as $it): ?>
      <tr>
        <td><?= (int) $it['id'] ?></td>
        <td><?= e($it['title']) ?><br><span class="muted"><?= e(mb_substr((string) $it['excerpt'], 0, 90)) ?></span></td>
        <td><?= e($it['category']) ?></td>
        <td><?= e((string) $it['published_at']) ?></td>
        <td><?= (int) $it['is_active'] === 1 ? 'Publicado' : 'Oculto' ?></td>
        <td>
          <div class="actions">
            <a class="btn btn--ghost btn--sm" href="<?= e(url('admin/blog.php?edit=' . (int) $it['id'])) ?>">Editar</a>
            <form method="post" class="inline">
              <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
              <input type="hidden" name="id" value="<?= (int) $it['id'] ?>">
              <input type="hidden" name="do" value="<?= (int) $it['is_active'] === 1 ? 'ocultar' : 'publicar' ?>">
              <button class="btn btn--ghost btn--sm" type="submit"><?= (int) $it['is_active'] === 1 ? 'Ocultar' : 'Publicar' ?></button>
            </form>
            <form method="post" class="inline" onsubmit="return confirm('¿Eliminar este artículo?');">
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
