<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  PANEL · APORTACIONES  ->  /admin/submissions.php
 *  Modera los testimonios y las preguntas enviadas por usuarios registrados.
 *  Solo las aprobadas se publican en la web. El "peso" alimenta el algoritmo
 *  que decide qué preguntas destacan en la portada.
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
        $score  = (int) ($_POST['score'] ?? 0);

        if ($id > 0 && in_array($action, ['aprobada', 'rechazada', 'pendiente'], true)) {
            submission_set_status($id, $action);
            if ($action === 'aprobada') {
                submission_set_score($id, $score);
            }
            $flash = ['ok', 'Aportación actualizada.'];
        } elseif ($id > 0 && $action === 'borrar') {
            db_query('DELETE FROM user_submissions WHERE id = ?', [$id]);
            $flash = ['ok', 'Aportación eliminada.'];
        }
    }
}

$type   = (string) ($_GET['type'] ?? '');
$status = (string) ($_GET['status'] ?? '');
$items  = submissions_for_admin($type, $status);

$counts = [];
foreach (array_keys(submission_types()) as $t) {
    $counts[$t] = (int) (db_one('SELECT COUNT(*) AS c FROM user_submissions WHERE stype = ?', [$t])['c'] ?? 0);
}
$pend = (int) (db_one("SELECT COUNT(*) AS c FROM user_submissions WHERE status = 'pendiente'")['c'] ?? 0);

admin_header('Aportaciones', true, 'Aportaciones');
?>
<h1>Aportaciones de usuarios</h1>

<?php if ($flash): ?>
  <div class="alert alert--<?= e($flash[0]) ?>"><?= e($flash[1]) ?></div>
<?php endif; ?>

<div class="cards">
  <div class="stat"><div class="stat__num"><?= (int) $counts['testimonio'] ?></div><div class="stat__label">Testimonios</div></div>
  <div class="stat"><div class="stat__num"><?= (int) $counts['pregunta'] ?></div><div class="stat__label">Preguntas</div></div>
  <div class="stat"><div class="stat__num"><?= $pend ?></div><div class="stat__label">Pendientes</div></div>
</div>

<p class="muted">
  Publicación automática:
  <strong><?= submissions_auto_approve() ? 'activada' : 'desactivada (se moderan)' ?></strong>.
  El «peso» (0-5) solo se aplica a las preguntas y alimenta el algoritmo de importancia que elige las destacadas de la portada.
</p>

<div class="actions" style="margin-bottom:1rem">
  <a class="btn-link <?= $type === '' ? 'is-active' : '' ?>" href="<?= e(url('admin/submissions.php')) ?>">Todas</a>
  <?php foreach (submission_types() as $key => $label): ?>
    <a class="btn-link <?= $type === $key ? 'is-active' : '' ?>" href="<?= e(url('admin/submissions.php?type=' . $key)) ?>"><?= e($label) ?></a>
  <?php endforeach; ?>
  <span class="muted">·</span>
  <a class="btn-link <?= $status === 'pendiente' ? 'is-active' : '' ?>" href="<?= e(url('admin/submissions.php?status=pendiente')) ?>">Pendientes</a>
  <a class="btn-link <?= $status === 'aprobada' ? 'is-active' : '' ?>" href="<?= e(url('admin/submissions.php?status=aprobada')) ?>">Aprobadas</a>
</div>

<?php if (!$items): ?>
  <div class="alert alert--info">Todavía no hay aportaciones.</div>
<?php else: ?>
<div class="table-wrap">
  <table>
    <thead>
      <tr><th>Fecha</th><th>Tipo</th><th>Usuario</th><th>Contenido</th><th>Estado</th><th>Peso</th><th>Acciones</th></tr>
    </thead>
    <tbody>
    <?php foreach ($items as $r): ?>
      <tr>
        <td class="muted"><?= e(date('d/m/Y H:i', strtotime((string) $r['created_at']))) ?></td>
        <td><span class="badge badge--leido"><?= e(submission_type_label((string) $r['stype'])) ?></span></td>
        <td><?= e((string) ($r['user_name'] ?: '—')) ?><br><span class="muted"><?= e((string) ($r['user_email'] ?? '')) ?></span></td>
        <td><strong><?= e($r['title']) ?></strong><br><span class="muted"><?= e(mb_substr((string) $r['body'], 0, 220)) ?></span></td>
        <td><span class="badge badge--<?= e($r['status'] === 'aprobada' ? 'leido' : ($r['status'] === 'pendiente' ? 'nuevo' : 'archivado')) ?>"><?= e($r['status']) ?></span></td>
        <td><?= $r['stype'] === 'pregunta' ? (int) $r['score'] . '/5' : '—' ?></td>
        <td>
          <div class="actions">
            <?php if ($r['status'] !== 'aprobada'): ?>
            <form method="post" class="inline">
              <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
              <input type="hidden" name="id" value="<?= (int) $r['id'] ?>">
              <input type="hidden" name="do" value="aprobada">
              <?php if ($r['stype'] === 'pregunta'): ?>
                <input type="text" name="score" value="<?= (int) $r['score'] ?>" inputmode="numeric"
                       title="Peso 0-5" style="width:3.2rem" aria-label="Peso 0-5">
              <?php endif; ?>
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
            <form method="post" class="inline" onsubmit="return confirm('¿Eliminar esta aportación?');">
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

<h2>¿Cómo se ordenan las preguntas?</h2>
<p class="muted">
  La portada muestra las preguntas más relevantes según un algoritmo que combina el peso manual (0-5),
  cuántos usuarios formulan la misma pregunta, el origen verificado y la antigüedad. Puedes ajustar los
  pesos en <code>app/config.php</code> (apartado <code>faq</code>).
</p>

<?php admin_footer(); ?>
