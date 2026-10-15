<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  PANEL · VALORACIONES  ->  /admin/reviews.php
 *  Modera las valoraciones de servicios y proyectos: aprobar, rechazar o
 *  eliminar. Solo las aprobadas se muestran en la web pública.
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
        $id     = (int) ($_POST['id'] ?? 0);
        $action = (string) ($_POST['do'] ?? '');
        if ($id > 0 && in_array($action, ['aprobada', 'rechazada', 'pendiente'], true)) {
            review_set_status($id, $action);
            $flash = ['ok', 'Valoración actualizada.'];
        } elseif ($id > 0 && $action === 'borrar') {
            db_query('DELETE FROM reviews WHERE id = ?', [$id]);
            $flash = ['ok', 'Valoración eliminada.'];
        }
    }
}

$status  = (string) ($_GET['status'] ?? '');
$items   = reviews_for_admin($status);
$total   = (int) (db_one('SELECT COUNT(*) AS c FROM reviews')['c'] ?? 0);
$pend    = (int) (db_one("SELECT COUNT(*) AS c FROM reviews WHERE status = 'pendiente'")['c'] ?? 0);
$appr    = (int) (db_one("SELECT COUNT(*) AS c FROM reviews WHERE status = 'aprobada'")['c'] ?? 0);
$avg     = reviews_summary();

admin_header('Valoraciones', true, 'Valoraciones');
?>
<h1>Valoraciones de servicios y proyectos</h1>

<?php if ($flash): ?>
  <div class="alert alert--<?= e($flash[0]) ?>"><?= e($flash[1]) ?></div>
<?php endif; ?>

<div class="cards">
  <div class="stat"><div class="stat__num"><?= $pend ?></div><div class="stat__label">Pendientes</div></div>
  <div class="stat"><div class="stat__num"><?= $appr ?></div><div class="stat__label">Aprobadas</div></div>
  <div class="stat"><div class="stat__num"><?= $total ?></div><div class="stat__label">Total recibidas</div></div>
  <div class="stat"><div class="stat__num"><?= e(number_format((float) $avg['average'], 1)) ?></div><div class="stat__label">Media (aprobadas)</div></div>
</div>

<p class="muted">
  Publicación automática:
  <strong><?= reviews_auto_approve() ? 'activada' : 'desactivada (se moderan)' ?></strong>.
  <?php if (!reviews_auto_approve()): ?>Aprueba cada valoración para que aparezca en la web.<?php endif; ?>
</p>

<div class="actions" style="margin-bottom:1rem">
  <a class="btn-link <?= $status === '' ? 'is-active' : '' ?>" href="<?= e(url('admin/reviews.php')) ?>">Todas</a>
  <a class="btn-link <?= $status === 'pendiente' ? 'is-active' : '' ?>" href="<?= e(url('admin/reviews.php?status=pendiente')) ?>">Pendientes</a>
  <a class="btn-link <?= $status === 'aprobada' ? 'is-active' : '' ?>" href="<?= e(url('admin/reviews.php?status=aprobada')) ?>">Aprobadas</a>
  <a class="btn-link <?= $status === 'rechazada' ? 'is-active' : '' ?>" href="<?= e(url('admin/reviews.php?status=rechazada')) ?>">Rechazadas</a>
</div>

<?php if (!$items): ?>
  <div class="alert alert--info">Todavía no hay valoraciones.</div>
<?php else: ?>
<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>Fecha</th><th>Destino</th><th>Puntuación</th><th>Autor</th>
        <th>Comentario</th><th>Estado</th><th>Acciones</th>
      </tr>
    </thead>
    <tbody>
    <?php foreach ($items as $r): ?>
      <tr>
        <td class="muted"><?= e(date('d/m/Y H:i', strtotime((string) $r['created_at']))) ?></td>
        <td>
          <span class="badge badge--leido"><?= e($r['target_type']) ?></span><br>
          <span class="muted"><?= e($r['target_label'] ?: '—') ?></span>
        </td>
        <td><strong><?= (int) $r['rating'] ?></strong>/5
          <span class="muted" aria-hidden="true"><?= str_repeat('★', (int) $r['rating']) ?></span>
        </td>
        <td><?= e($r['author_name']) ?><br><span class="muted"><?= e($r['author_email']) ?></span></td>
        <td><?= nl2br(e(mb_substr((string) $r['comment'], 0, 400))) ?></td>
        <td><span class="badge badge--<?= e($r['status'] === 'aprobada' ? 'leido' : ($r['status'] === 'pendiente' ? 'nuevo' : 'archivado')) ?>"><?= e($r['status']) ?></span></td>
        <td>
          <div class="actions">
            <?php if ($r['status'] !== 'aprobada'): ?>
            <form method="post" class="inline">
              <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
              <input type="hidden" name="id" value="<?= (int) $r['id'] ?>">
              <input type="hidden" name="do" value="aprobada">
              <button class="btn-link" type="submit">Aprobar</button>
            </form>
            <?php endif; ?>
            <?php if ($r['status'] !== 'rechazada'): ?>
            <form method="post" class="inline">
              <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
              <input type="hidden" name="id" value="<?= (int) $r['id'] ?>">
              <input type="hidden" name="do" value="rechazada">
              <button class="btn-link" type="submit">Rechazar</button>
            </form>
            <?php endif; ?>
            <form method="post" class="inline" onsubmit="return confirm('¿Eliminar esta valoración?');">
              <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
              <input type="hidden" name="id" value="<?= (int) $r['id'] ?>">
              <input type="hidden" name="do" value="borrar">
              <button class="btn-link" type="submit">Eliminar</button>
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
