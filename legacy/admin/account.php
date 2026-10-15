<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  ÁREA PRIVADA · MI CUENTA  ->  /admin/account.php
 *  ----------------------------------------------------------------------------
 *  Página para cualquier persona con sesión iniciada (no requiere ser admin).
 *  Aquí viven los formularios que antes estaban abiertos en la web pública:
 *    - Enviar un testimonio.
 *    - Proponer una pregunta frecuente.
 *  Además, cada usuario ve el estado de las aportaciones que ya ha enviado.
 *
 *  El envío se resuelve en el servidor reutilizando validate_submission(), así
 *  el área privada y la API comparten exactamente las mismas reglas.
 * ============================================================================
 */
require_once __DIR__ . '/bootstrap.php';
require_login();

$user   = current_user();
$userId = (int) $user['id'];
$flash  = null;

/* --- Envío de una aportación (con CSRF) ----------------------------------- */
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    if (!csrf_verify($_POST['_csrf'] ?? null)) {
        $flash = ['error', 'Token de seguridad inválido. Vuelve a intentarlo.'];
    } elseif (!submissions_enabled()) {
        $flash = ['error', 'Las aportaciones están desactivadas en este momento.'];
    } else {
        $result = validate_submission([
            'tipo'   => (string) ($_POST['tipo'] ?? ''),
            'titulo' => (string) ($_POST['titulo'] ?? ''),
            'texto'  => (string) ($_POST['texto'] ?? ''),
        ]);

        if (!empty($result['errors'])) {
            $flash = ['error', implode(' ', array_values($result['errors']))];
        } else {
            $data   = $result['data'];
            $status = submissions_auto_approve() ? 'aprobada' : 'pendiente';
            $now    = date('Y-m-d H:i:s');

            $id = db_insert('user_submissions', [
                'user_id'    => $userId,
                'stype'      => $data['stype'],
                'title'      => $data['title'],
                'body'       => $data['body'],
                'status'     => $status,
                'ip'         => client_ip(),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            audit('submission_created', ['id' => $id, 'type' => $data['stype'], 'user' => $userId]);

            // Aviso por correo al administrador (no bloquea la respuesta).
            $tipo  = submission_type_label($data['stype']);
            $autor = (string) ($user['name'] ?: $user['email']);
            $html  = mailer_template("Nueva aportación: $tipo", "
                <p><strong>Tipo:</strong> " . e($tipo) . "</p>
                <p><strong>Autor:</strong> " . e($autor) . "</p>
                <p><strong>Título:</strong> " . e($data['title']) . "</p>
                <p><strong>Detalle:</strong></p><p>" . nl2br(e($data['body'])) . "</p>
                <p><em>Estado: $status.</em></p>
            ");
            $notify = mail_notify_to();
            if (filter_var($notify, FILTER_VALIDATE_EMAIL)) {
                @send_mail($notify, 'Nueva aportación · ' . config('site_name'), $html);
            }

            $flash = ['ok', $status === 'aprobada'
                ? '¡Gracias! Tu aportación ya está publicada.'
                : '¡Gracias! Tu aportación se revisará antes de publicarse.'];
        }
    }
}

/* --- Datos para la vista -------------------------------------------------- */
$aportaciones = submissions_for_user($userId, 20);
$esAdmin      = is_admin();
$labels       = submission_status_labels();
$badge        = ['pendiente' => 'nuevo', 'aprobada' => 'leido', 'rechazada' => 'archivado'];
$min          = (int) config('security.password_min', 8);

admin_header('Mi cuenta', true, '');
?>
<h1>Mi cuenta</h1>

<?php if ($flash): ?>
  <div class="alert alert--<?= e($flash[0]) ?>"><?= e($flash[1]) ?></div>
<?php endif; ?>

<div class="cards">
  <div class="stat"><div class="stat__num"><?= count($aportaciones) ?></div><div class="stat__label">Aportaciones enviadas</div></div>
  <div class="stat"><div class="stat__num"><?= (int) (db_one("SELECT COUNT(*) AS c FROM user_submissions WHERE user_id = ? AND status = 'aprobada'", [$userId])['c'] ?? 0) ?></div><div class="stat__label">Publicadas</div></div>
  <div class="stat"><div class="stat__num"><?= (int) (db_one("SELECT COUNT(*) AS c FROM user_submissions WHERE user_id = ? AND status = 'pendiente'", [$userId])['c'] ?? 0) ?></div><div class="stat__label">En revisión</div></div>
  <div class="stat"><div class="stat__num"><?= $esAdmin ? 'Admin' : 'Usuario' ?></div><div class="stat__label">Tipo de cuenta</div></div>
</div>

<p class="muted">
  Has iniciado sesión como <strong><?= e((string) ($user['name'] ?: $user['email'])) ?></strong>.
  <?php if ($esAdmin): ?>
    Tienes permisos de administrador: <a href="<?= e(url('admin/')) ?>">ir al panel de gestión</a>.
  <?php endif; ?>
</p>

<?php if (!submissions_enabled()): ?>
  <div class="alert alert--info">Las aportaciones están desactivadas en este momento.</div>
<?php else: ?>
<div class="grid-2">
  <!-- Formulario: enviar un testimonio -->
  <form class="js-account-form" method="post" novalidate>
    <div class="settings-card">
      <h2>Comparte tu testimonio</h2>
      <p class="muted">Cuenta tu experiencia con C-ROTULUS. Se revisará antes de publicarse.</p>
      <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
      <input type="hidden" name="tipo" value="testimonio">
      <div class="field">
        <label for="tTitle">Tu nombre</label>
        <input type="text" id="tTitle" name="titulo" data-validate="name" required maxlength="120" autocomplete="name">
        <?= field_error_span('titulo') ?>
      </div>
      <div class="field">
        <label for="tText">Tu experiencia</label>
        <textarea id="tText" name="texto" data-validate="text" required minlength="10" maxlength="1500" rows="4"></textarea>
        <?= field_error_span('texto') ?>
      </div>
      <button class="btn" type="submit">Enviar testimonio</button>
      <div class="alert alert--ok" data-account-ok role="status" hidden></div>
      <div class="alert alert--error" data-account-error role="alert" hidden></div>
    </div>
  </form>

  <!-- Formulario: proponer una pregunta -->
  <form class="js-account-form" method="post" novalidate>
    <div class="settings-card">
      <h2>Propón una pregunta</h2>
      <p class="muted">¿Echas en falta alguna duda en las preguntas frecuentes? Proponla y la valoramos.</p>
      <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
      <input type="hidden" name="tipo" value="pregunta">
      <div class="field">
        <label for="qTitle">Tu pregunta</label>
        <input type="text" id="qTitle" name="titulo" data-validate="question" required minlength="8" maxlength="200"
               placeholder="Ej.: ¿Podéis migrar mi web actual sin perder posicionamiento?">
        <?= field_error_span('titulo') ?>
      </div>
      <div class="field">
        <label for="qText">Detalle <span class="muted">(opcional)</span></label>
        <textarea id="qText" name="texto" maxlength="1500" rows="4"></textarea>
        <?= field_error_span('texto') ?>
      </div>
      <button class="btn" type="submit">Enviar pregunta</button>
      <div class="alert alert--ok" data-account-ok role="status" hidden></div>
      <div class="alert alert--error" data-account-error role="alert" hidden></div>
    </div>
  </form>
</div>
<?php endif; ?>

<h2>Mis aportaciones</h2>
<?php if (!$aportaciones): ?>
  <div class="alert alert--info">Todavía no has enviado ninguna aportación.</div>
<?php else: ?>
<div class="table-wrap">
  <table>
    <thead>
      <tr><th>Fecha</th><th>Tipo</th><th>Contenido</th><th>Estado</th></tr>
    </thead>
    <tbody>
    <?php foreach ($aportaciones as $a): ?>
      <tr>
        <td class="muted"><?= e(date('d/m/Y H:i', strtotime((string) $a['created_at']))) ?></td>
        <td><span class="badge badge--leido"><?= e(submission_type_label((string) $a['stype'])) ?></span></td>
        <td><strong><?= e($a['title']) ?></strong><?php if ($a['body'] !== ''): ?><br><span class="muted"><?= e(mb_substr((string) $a['body'], 0, 220)) ?></span><?php endif; ?></td>
        <td><span class="badge badge--<?= e($badge[$a['status']] ?? 'leido') ?>"><?= e($labels[$a['status']] ?? $a['status']) ?></span></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php endif; ?>

<?php admin_footer(); ?>
