<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  PANEL · AJUSTES  ->  /admin/settings.php
 *  Edita los datos del sitio: teléfono, correo, dirección, horario, mapa y
 *  redes sociales. Se guardan en la tabla "settings" y la web los consume.
 * ============================================================================
 */
require_once __DIR__ . '/bootstrap.php';
require_admin();

$flash = null;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    if (!csrf_verify($_POST['_csrf'] ?? null)) {
        $flash = ['error', 'Token de seguridad inválido.'];
    } else {
        $do = (string) ($_POST['do'] ?? '');
        if ($do === 'test_mail') {
            $to = (string) setting('correo', config('defaults.correo'));
            if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
                $flash = ['error', 'Configura antes un correo de contacto válido.'];
            } else {
                $ok = send_mail(
                    $to,
                    'Prueba de envío · ' . (string) config('site_name'),
                    mailer_template('Prueba de envío de correo', '<p>Si lees este mensaje, tu correo está bien configurado.</p>')
                );
                $transport = (string) config('mail.transport', 'log');
                $flash = $ok
                    ? ['ok', "Correo de prueba enviado a $to (transporte: $transport)."]
                    : ['error', "No se pudo enviar el correo (transporte: $transport). Revisa la configuración en app/config.php."];
            }
        } elseif ($do === 'refresh_trustpilot') {
            $tp = trustpilot_fetch(true);
            $flash = $tp['ok']
                ? ['ok', 'Trustpilot actualizado: ' . (int) $tp['summary']['total'] . ' reseñas, nota ' . number_format((float) $tp['summary']['average'], 1) . '/5.']
                : ['error', 'Trustpilot no permite leer la ficha directamente (bloquea las peticiones del servidor). Usa el widget de abajo: rellena el «ID de Trustpilot (TrustBox)» y la web mostrará tus reseñas reales automáticamente.'];
        } else {
            $fields     = settings_editable();
            $checkboxes = settings_checkboxes();
            $secrets    = settings_secret_keys();
            $numerics   = [
                'faq_portal_count', 'mail_smtp_port',
                'security_password_min', 'security_session_lifetime',
                'security_contact_rate_max', 'security_contact_rate_window',
                'security_login_rate_max', 'security_login_rate_window',
                'security_review_rate_max', 'security_review_rate_window',
                'security_submission_rate_max', 'security_submission_rate_window',
            ];
            $urlFields  = ['facebook', 'instagram', 'linkedin', 'github', 'google_maps_url', 'trustpilot_url', 'google_reviews_url', 'google_redirect_uri', 'og_image'];
            $selects    = ['mail_transport' => ['log', 'mail', 'smtp'], 'mail_smtp_secure' => ['tls', 'ssl', 'none'], 'reviews_provider' => ['trustpilot', 'google', 'custom']];
            // Cada formulario declara qué casillas controla (campo _checkboxes),
            // así guardar una pestaña no desactiva las casillas de otras.
            $scope = array_filter(array_map('trim', explode(',', (string) ($_POST['_checkboxes'] ?? ''))));

            foreach ($fields as $key) {
                // Las casillas solo se tocan si el formulario las declara.
                if (in_array($key, $checkboxes, true)) {
                    if (in_array($key, $scope, true)) {
                        setting_set($key, isset($_POST[$key]) ? '1' : '0');
                    }
                    continue;
                }
                if (!array_key_exists($key, $_POST)) {
                    continue;
                }
                $value = (string) $_POST[$key];

                // Secretos enmascarados: si el campo no se ha cambiado, se conserva.
                if (in_array($key, $secrets, true) && $value === '********') {
                    continue;
                }

                $value = clean_text($value);
                if (in_array($key, $numerics, true)) {
                    $value = (string) max(0, (int) preg_replace('/\D/', '', $value));
                } elseif ($key === 'mapa_embed') {
                    $value = sanitize_map_embed($value);
                } elseif ($key === 'trustpilot_business_id') {
                    $value = preg_replace('/[^A-Za-z0-9_\-]/', '', $value) ?? '';
                } elseif (isset($selects[$key])) {
                    $value = in_array($value, $selects[$key], true) ? $value : $selects[$key][0];
                } elseif (in_array($key, $urlFields, true)) {
                    $value = sanitize_url($value);
                } elseif ($key === 'mail_from_email') {
                    $value = filter_var($value, FILTER_VALIDATE_EMAIL) ? $value : '';
                } elseif ($key === 'site_url') {
                    $value = rtrim($value, '/');
                }
                setting_set($key, $value);
            }
            $flash = ['ok', 'Ajustes guardados.'];
            audit('settings_updated');
        }
    }
}

$s = settings_all();

/** Limpia una URL (permite vacio o http/https). */
function sanitize_url(string $value): string
{
    $value = trim($value);
    if ($value === '' || in_array($value, ['[URL_FACEBOOK]', '[URL_INSTAGRAM]', '[URL_LINKEDIN]', '[URL_GITHUB]', '[TU-DOMINIO]', '[URL_GOOGLE_REVIEWS]'], true)) {
        return $value;
    }
    if ($value === 'https://es.trustpilot.com/review/[TU-DOMINIO]') {
        return $value;
    }
    return filter_var($value, FILTER_VALIDATE_URL) ? $value : '';
}

/**
 * Saneado del mapa:
 *  - Si pegan un <iframe ... src="URL">, extraemos y validamos la URL.
 *  - Si pegan una URL suelta, la aceptamos.
 */
function sanitize_map_embed(string $value): string
{
    $value = trim($value);
    if ($value === '') {
        return '';
    }
    if (stripos($value, '<iframe') !== false) {
        if (preg_match('/src\s*=\s*["\']([^"\']+)["\']/i', $value, $m)) {
            $src = $m[1];
            // Solo dominios de mapas permitidos.
            if (preg_match('#^https://(www\.)?(google\.[a-z.]+/maps|maps\.google\.[a-z.]+|www\.google\.com/maps|maps\.app\.goo\.gl|goo\.gl/maps)#i', $src)) {
                return $src;
            }
        }
        return '';
    }
    if (filter_var($value, FILTER_VALIDATE_URL)
        && preg_match('#^https://(www\.)?(google\.[a-z.]+/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl)#i', $value)) {
        return $value;
    }
    return '';
}

admin_header('Ajustes', true, 'Ajustes');
?>
<h1>Ajustes del sitio</h1>
<p class="muted">
  Configura aquí todo lo que la web necesita: contacto, correo de envío, reseñas,
  aportaciones, seguridad, integraciones y rutas. Lo guardado aquí tiene prioridad
  sobre <code>app/config.php</code>.
</p>

<?php if ($flash): ?>
  <div class="alert alert--<?= e($flash[0]) ?>"><?= e($flash[1]) ?></div>
<?php endif; ?>

<!-- Pestañas de ajustes (navegación por secciones, sin recargar) -->
<div class="tabs" data-tabs>
  <div class="tabs__nav" role="tablist" aria-label="Secciones de ajustes">
    <button type="button" role="tab" class="tabs__btn is-active" data-tab="general" aria-selected="true">General</button>
    <button type="button" role="tab" class="tabs__btn" data-tab="contacto" aria-selected="false">Contacto</button>
    <button type="button" role="tab" class="tabs__btn" data-tab="correo" aria-selected="false">Correo</button>
    <button type="button" role="tab" class="tabs__btn" data-tab="resenas" aria-selected="false">Reseñas</button>
    <button type="button" role="tab" class="tabs__btn" data-tab="aportaciones" aria-selected="false">Aportaciones</button>
    <button type="button" role="tab" class="tabs__btn" data-tab="seguridad" aria-selected="false">Seguridad</button>
    <button type="button" role="tab" class="tabs__btn" data-tab="google" aria-selected="false">Google</button>
    <button type="button" role="tab" class="tabs__btn" data-tab="rutas" aria-selected="false">Rutas</button>
  </div>

  <!-- ============================ GENERAL ============================ -->
  <section class="tabs__panel is-active" data-panel="general" role="tabpanel">
    <form method="post" action="<?= e(url('admin/settings.php')) ?>">
      <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
      <input type="hidden" name="_checkboxes" value="maintenance_mode">

      <div class="settings-card">
        <h2>Identidad del sitio</h2>
        <p class="muted">Nombre, dirección web y textos que aparecen en los buscadores y al compartir la web.</p>
        <div class="grid-2">
          <div class="field">
            <label for="site_name">Nombre del sitio</label>
            <input type="text" id="site_name" name="site_name" value="<?= e($s['site_name'] ?? '') ?>">
          </div>
          <div class="field">
            <label for="site_url">URL del sitio</label>
            <input type="text" id="site_url" name="site_url" value="<?= e($s['site_url'] ?? '') ?>" placeholder="https://www.tu-dominio.com">
            <p class="muted">Sin barra final. Se usa en los correos y en las URLs absolutas.</p>
          </div>
          <div class="field">
            <label for="meta_description">Meta descripción (SEO)</label>
            <input type="text" id="meta_description" name="meta_description" maxlength="300" value="<?= e($s['meta_description'] ?? '') ?>">
          </div>
          <div class="field">
            <label for="meta_keywords">Palabras clave (SEO)</label>
            <input type="text" id="meta_keywords" name="meta_keywords" value="<?= e($s['meta_keywords'] ?? '') ?>">
          </div>
          <div class="field">
            <label for="og_image">Imagen para compartir (Open Graph)</label>
            <input type="text" id="og_image" name="og_image" value="<?= e($s['og_image'] ?? '') ?>" placeholder="assets/img/og-image.jpg">
          </div>
        </div>
      </div>

      <div class="settings-card">
        <h2>Modo mantenimiento</h2>
        <p class="muted">Muestra un aviso en la web pública y oculta el formulario de contacto.</p>
        <div class="grid-2">
          <div class="field">
            <label><input type="checkbox" name="maintenance_mode" value="1" <?= ($s['maintenance_mode'] ?? '0') === '1' ? 'checked' : '' ?>>
              Activar el modo mantenimiento</label>
          </div>
          <div class="field">
            <label for="maintenance_message">Mensaje mostrado</label>
            <input type="text" id="maintenance_message" name="maintenance_message" value="<?= e($s['maintenance_message'] ?? '') ?>">
          </div>
        </div>
      </div>

      <button class="btn" type="submit">Guardar ajustes generales</button>
    </form>
  </section>

  <!-- ============================ CONTACTO ============================ -->
  <section class="tabs__panel" data-panel="contacto" role="tabpanel">
    <form method="post" action="<?= e(url('admin/settings.php')) ?>">
      <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">

      <div class="settings-card">
        <h2>Contacto</h2>
        <p class="muted">Estos datos se muestran en la web, en el pie y en los enlaces de teléfono, correo y WhatsApp.</p>
        <div class="grid-2">
          <div class="field">
            <label for="telefono">Teléfono</label>
            <input type="text" id="telefono" name="telefono" value="<?= e($s['telefono'] ?? '') ?>">
          </div>
          <div class="field">
            <label for="whatsapp">WhatsApp (solo dígitos, con prefijo país)</label>
            <input type="text" id="whatsapp" name="whatsapp" value="<?= e($s['whatsapp'] ?? '') ?>" placeholder="34600123456">
          </div>
          <div class="field">
            <label for="correo">Correo electrónico público</label>
            <input type="email" id="correo" name="correo" value="<?= e($s['correo'] ?? '') ?>">
          </div>
          <div class="field">
            <label for="horario">Horario</label>
            <input type="text" id="horario" name="horario" value="<?= e($s['horario'] ?? '') ?>">
          </div>
          <div class="field">
            <label for="direccion">Dirección</label>
            <input type="text" id="direccion" name="direccion" value="<?= e($s['direccion'] ?? '') ?>">
          </div>
          <div class="field">
            <label for="ciudad">Ciudad</label>
            <input type="text" id="ciudad" name="ciudad" value="<?= e($s['ciudad'] ?? '') ?>">
          </div>
        </div>
      </div>

      <div class="settings-card">
        <h2>Mapa</h2>
        <div class="field">
          <label for="mapa_embed">URL del mapa (Google Maps embed)</label>
          <input type="text" id="mapa_embed" name="mapa_embed" value="<?= e($s['mapa_embed'] ?? '') ?>"
                 placeholder="https://www.google.com/maps/embed?pb=...">
          <p class="muted">Pega la URL que da Google Maps en «Compartir → Insertar un mapa». Si lo dejas vacío, se muestra la imagen por defecto.</p>
        </div>
        <div class="field">
          <label for="google_maps_url">Enlace «Cómo llegar»</label>
          <input type="text" id="google_maps_url" name="google_maps_url" value="<?= e($s['google_maps_url'] ?? '') ?>">
        </div>
        <?php if (!empty($s['mapa_embed'])): ?>
          <iframe src="<?= e($s['mapa_embed']) ?>" width="100%" height="280" style="border:0;border-radius:14px;margin-top:.5rem" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Vista previa del mapa"></iframe>
        <?php endif; ?>
      </div>

      <div class="settings-card">
        <h2>Redes sociales</h2>
        <div class="grid-2">
          <div class="field"><label for="facebook">Facebook</label>
            <input type="text" id="facebook" name="facebook" value="<?= e($s['facebook'] ?? '') ?>"></div>
          <div class="field"><label for="instagram">Instagram</label>
            <input type="text" id="instagram" name="instagram" value="<?= e($s['instagram'] ?? '') ?>"></div>
          <div class="field"><label for="linkedin">LinkedIn</label>
            <input type="text" id="linkedin" name="linkedin" value="<?= e($s['linkedin'] ?? '') ?>"></div>
          <div class="field"><label for="github">GitHub</label>
            <input type="text" id="github" name="github" value="<?= e($s['github'] ?? '') ?>"></div>
        </div>
      </div>

      <button class="btn" type="submit">Guardar contacto</button>
    </form>
  </section>

  <!-- ============================ CORREO ============================ -->
  <section class="tabs__panel" data-panel="correo" role="tabpanel">
    <form method="post" action="<?= e(url('admin/settings.php')) ?>">
      <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
      <div class="settings-card">
        <h2>Envío de correo</h2>
        <p class="muted">
          Correo que la web usa para verificar cuentas, recuperar contraseñas y avisarte
          de nuevos mensajes. Con <strong>SMTP</strong> se envían correos reales (recomendado).
        </p>
        <div class="grid-2">
          <div class="field">
            <label for="mail_transport">Método de envío</label>
            <?php $tr = (string) ($s['mail_transport'] ?? 'log'); ?>
            <select id="mail_transport" name="mail_transport">
              <option value="log" <?= $tr === 'log' ? 'selected' : '' ?>>Log (pruebas, no envía)</option>
              <option value="mail" <?= $tr === 'mail' ? 'selected' : '' ?>>mail() del hosting</option>
              <option value="smtp" <?= $tr === 'smtp' ? 'selected' : '' ?>>SMTP (recomendado)</option>
            </select>
          </div>
          <div class="field">
            <label for="mail_from_name">Nombre del remitente</label>
            <input type="text" id="mail_from_name" name="mail_from_name" value="<?= e($s['mail_from_name'] ?? '') ?>">
          </div>
          <div class="field">
            <label for="mail_from_email">Correo del remitente (From)</label>
            <input type="email" id="mail_from_email" name="mail_from_email" value="<?= e($s['mail_from_email'] ?? '') ?>" placeholder="no-reply@tu-dominio.com">
          </div>
          <div class="field">
            <label for="mail_smtp_host">Servidor SMTP</label>
            <input type="text" id="mail_smtp_host" name="mail_smtp_host" value="<?= e($s['mail_smtp_host'] ?? '') ?>" placeholder="smtp.gmail.com">
          </div>
          <div class="field">
            <label for="mail_smtp_port">Puerto SMTP</label>
            <input type="text" id="mail_smtp_port" name="mail_smtp_port" inputmode="numeric" value="<?= e($s['mail_smtp_port'] ?? '587') ?>">
          </div>
          <div class="field">
            <label for="mail_smtp_secure">Seguridad SMTP</label>
            <?php $sec = (string) ($s['mail_smtp_secure'] ?? 'tls'); ?>
            <select id="mail_smtp_secure" name="mail_smtp_secure">
              <option value="tls" <?= $sec === 'tls' ? 'selected' : '' ?>>STARTTLS (puerto 587)</option>
              <option value="ssl" <?= $sec === 'ssl' ? 'selected' : '' ?>>SSL (puerto 465)</option>
              <option value="none" <?= $sec === 'none' ? 'selected' : '' ?>>Sin cifrado</option>
            </select>
          </div>
          <div class="field">
            <label for="mail_smtp_user">Usuario SMTP</label>
            <input type="text" id="mail_smtp_user" name="mail_smtp_user" value="<?= e($s['mail_smtp_user'] ?? '') ?>" autocomplete="off" placeholder="tu-cuenta@gmail.com">
          </div>
          <div class="field">
            <label for="mail_smtp_pass">Contraseña SMTP</label>
            <input type="password" id="mail_smtp_pass" name="mail_smtp_pass"
                   value="<?= ($s['mail_smtp_pass'] ?? '') !== '' ? '********' : '' ?>" autocomplete="new-password" placeholder="contraseña de aplicación">
            <p class="muted">Deja el valor enmascarado para no cambiarla. Con Gmail usa una «contraseña de aplicación».</p>
          </div>
        </div>
      </div>
      <button class="btn" type="submit">Guardar correo</button>
    </form>

    <div class="settings-card">
      <h3>Probar el envío</h3>
      <p class="muted">Envía un correo de prueba al correo de contacto configurado.</p>
      <form method="post" action="<?= e(url('admin/settings.php')) ?>">
        <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
        <input type="hidden" name="do" value="test_mail">
        <button class="btn btn--ghost" type="submit">Enviar correo de prueba a <?= e($s['correo'] ?? '') ?></button>
      </form>
    </div>

    <div class="settings-card">
      <h3>Ayuda: Gmail</h3>
      <ul class="muted" style="margin:0;padding-left:1.1rem;line-height:1.7">
        <li>Servidor: <code>smtp.gmail.com</code> · Puerto <code>587</code> · Seguridad <code>STARTTLS</code>.</li>
        <li>Usuario: tu dirección completa de Gmail.</li>
        <li>Contraseña: una <strong>contraseña de aplicación</strong> de 16 caracteres (requiere verificación en dos pasos). No uses tu contraseña normal.</li>
      </ul>
    </div>
  </section>

  <!-- ============================ RESEÑAS ============================ -->
  <section class="tabs__panel" data-panel="resenas" role="tabpanel">
    <form method="post" action="<?= e(url('admin/settings.php')) ?>">
      <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
      <input type="hidden" name="_checkboxes" value="reviews_enabled,reviews_auto_approve">
      <div class="settings-card">
        <h2>Valoraciones y reseñas</h2>
        <p class="muted">Los clientes registrados pueden valorar cada servicio y proyecto. Aquí decides si se publican solas o se moderan.</p>
        <div class="grid-2">
          <div class="field">
            <label><input type="checkbox" name="reviews_enabled" value="1" <?= ($s['reviews_enabled'] ?? '1') === '1' ? 'checked' : '' ?>>
              Activar el módulo de valoraciones</label>
          </div>
          <div class="field">
            <label><input type="checkbox" name="reviews_auto_approve" value="1" <?= ($s['reviews_auto_approve'] ?? '0') === '1' ? 'checked' : '' ?>>
              Publicar automáticamente (sin moderación)</label>
          </div>
          <div class="field">
            <label for="reviews_provider">Herramienta externa de reseñas</label>
            <?php $prov = (string) ($s['reviews_provider'] ?? 'trustpilot'); ?>
            <select id="reviews_provider" name="reviews_provider">
              <option value="trustpilot" <?= $prov === 'trustpilot' ? 'selected' : '' ?>>Trustpilot</option>
              <option value="google" <?= $prov === 'google' ? 'selected' : '' ?>>Google Reviews</option>
              <option value="custom" <?= $prov === 'custom' ? 'selected' : '' ?>>Solo valoraciones propias</option>
            </select>
          </div>
          <div class="field">
            <label for="trustpilot_business_id">ID de Trustpilot (TrustBox)</label>
            <input type="text" id="trustpilot_business_id" name="trustpilot_business_id" value="<?= e($s['trustpilot_business_id'] ?? '') ?>" placeholder="tu-business-unit-id">
          </div>
          <div class="field">
            <label for="trustpilot_template">Aspecto del widget</label>
            <?php $tpl = (string) ($s['trustpilot_template'] ?? 'carrusel'); ?>
            <select id="trustpilot_template" name="trustpilot_template">
              <option value="carrusel" <?= $tpl === 'carrusel' ? 'selected' : '' ?>>Carrusel de reseñas</option>
              <option value="estrellas" <?= $tpl === 'estrellas' ? 'selected' : '' ?>>Mini valoración (estrellas)</option>
            </select>
          </div>
          <div class="field">
            <label for="trustpilot_url">Enlace a tu ficha en Trustpilot</label>
            <input type="text" id="trustpilot_url" name="trustpilot_url" value="<?= e($s['trustpilot_url'] ?? '') ?>" placeholder="https://es.trustpilot.com/review/tu-dominio.com">
          </div>
          <div class="field">
            <label for="google_reviews_url">Enlace a tu ficha en Google</label>
            <input type="text" id="google_reviews_url" name="google_reviews_url" value="<?= e($s['google_reviews_url'] ?? '') ?>" placeholder="https://g.page/r/tu-ficha/review">
            <p class="muted">Botón «Ver todas en Google» de la sección de Opiniones.</p>
          </div>
        </div>
      </div>
      <button class="btn" type="submit">Guardar reseñas</button>
    </form>

    <?php $tpCache = db_one("SELECT updated_at FROM settings WHERE skey LIKE 'trustpilot_cache_%' ORDER BY updated_at DESC LIMIT 1"); ?>
    <div class="settings-card">
      <h3>Reseñas de Trustpilot</h3>
      <p class="muted">Se leen de la ficha pública (sin API key) y se cachean 6 horas.</p>
      <form method="post" action="<?= e(url('admin/settings.php')) ?>">
        <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
        <input type="hidden" name="do" value="refresh_trustpilot">
        <button class="btn btn--ghost" type="submit">Actualizar reseñas de Trustpilot</button>
        <?php if ($tpCache): ?>
          <span class="muted" style="margin-left:.6rem">Última lectura: <?= e(date('d/m/Y H:i', strtotime((string) $tpCache['updated_at']))) ?></span>
        <?php endif; ?>
      </form>
    </div>
  </section>

  <!-- ============================ APORTACIONES ============================ -->
  <section class="tabs__panel" data-panel="aportaciones" role="tabpanel">
    <form method="post" action="<?= e(url('admin/settings.php')) ?>">
      <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
      <input type="hidden" name="_checkboxes" value="submissions_enabled,submissions_auto_approve">
      <div class="settings-card">
        <h2>Aportaciones de usuarios</h2>
        <p class="muted">
          Permite que las personas <strong>registradas</strong> envíen testimonios y propongan
          preguntas frecuentes. Solo se publican las aprobadas (salvo publicación automática).
        </p>
        <div class="grid-2">
          <div class="field">
            <label><input type="checkbox" name="submissions_enabled" value="1" <?= ($s['submissions_enabled'] ?? '1') === '1' ? 'checked' : '' ?>>
              Activar las aportaciones de usuarios</label>
          </div>
          <div class="field">
            <label><input type="checkbox" name="submissions_auto_approve" value="1" <?= ($s['submissions_auto_approve'] ?? '0') === '1' ? 'checked' : '' ?>>
              Publicar automáticamente (sin moderación)</label>
          </div>
          <div class="field">
            <label for="faq_portal_count">Nº de preguntas destacadas en la portada</label>
            <input type="text" id="faq_portal_count" name="faq_portal_count" inputmode="numeric" value="<?= e($s['faq_portal_count'] ?? '6') ?>">
            <p class="muted">El algoritmo de importancia elige cuáles se muestran.</p>
          </div>
        </div>
      </div>
      <button class="btn" type="submit">Guardar aportaciones</button>
    </form>
  </section>

  <!-- ============================ SEGURIDAD ============================ -->
  <section class="tabs__panel" data-panel="seguridad" role="tabpanel">
    <form method="post" action="<?= e(url('admin/settings.php')) ?>">
      <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
      <input type="hidden" name="_checkboxes" value="security_session_bind_ip">
      <div class="settings-card">
        <h2>Seguridad y contraseñas</h2>
        <div class="grid-2">
          <div class="field">
            <label for="security_password_min">Longitud mínima de contraseña</label>
            <input type="text" id="security_password_min" name="security_password_min" inputmode="numeric" value="<?= e($s['security_password_min'] ?? '8') ?>">
          </div>
          <div class="field">
            <label for="security_session_lifetime">Duración de la sesión (segundos)</label>
            <input type="text" id="security_session_lifetime" name="security_session_lifetime" inputmode="numeric" value="<?= e($s['security_session_lifetime'] ?? '2592000') ?>">
            <p class="muted">2592000 = 30 días.</p>
          </div>
          <div class="field">
            <label><input type="checkbox" name="security_session_bind_ip" value="1" <?= ($s['security_session_bind_ip'] ?? '0') === '1' ? 'checked' : '' ?>>
              Vincular la sesión a la IP del visitante</label>
            <p class="muted">Actívalo solo en un hosting simple. Tras un CDN o balanceador, deja desactivado.</p>
          </div>
        </div>
      </div>

      <div class="settings-card">
        <h3>Límites anti-spam (por IP)</h3>
        <p class="muted">Número máximo de envíos permitidos dentro de cada ventana de tiempo (en segundos).</p>
        <div class="grid-2">
          <div class="field">
            <label for="security_contact_rate_max">Mensajes de contacto · máximo</label>
            <input type="text" id="security_contact_rate_max" name="security_contact_rate_max" inputmode="numeric" value="<?= e($s['security_contact_rate_max'] ?? '5') ?>">
          </div>
          <div class="field">
            <label for="security_contact_rate_window">Mensajes de contacto · ventana (s)</label>
            <input type="text" id="security_contact_rate_window" name="security_contact_rate_window" inputmode="numeric" value="<?= e($s['security_contact_rate_window'] ?? '3600') ?>">
          </div>
          <div class="field">
            <label for="security_login_rate_max">Intentos de login · máximo</label>
            <input type="text" id="security_login_rate_max" name="security_login_rate_max" inputmode="numeric" value="<?= e($s['security_login_rate_max'] ?? '10') ?>">
          </div>
          <div class="field">
            <label for="security_login_rate_window">Intentos de login · ventana (s)</label>
            <input type="text" id="security_login_rate_window" name="security_login_rate_window" inputmode="numeric" value="<?= e($s['security_login_rate_window'] ?? '900') ?>">
          </div>
          <div class="field">
            <label for="security_review_rate_max">Valoraciones · máximo</label>
            <input type="text" id="security_review_rate_max" name="security_review_rate_max" inputmode="numeric" value="<?= e($s['security_review_rate_max'] ?? '6') ?>">
          </div>
          <div class="field">
            <label for="security_review_rate_window">Valoraciones · ventana (s)</label>
            <input type="text" id="security_review_rate_window" name="security_review_rate_window" inputmode="numeric" value="<?= e($s['security_review_rate_window'] ?? '3600') ?>">
          </div>
          <div class="field">
            <label for="security_submission_rate_max">Aportaciones · máximo</label>
            <input type="text" id="security_submission_rate_max" name="security_submission_rate_max" inputmode="numeric" value="<?= e($s['security_submission_rate_max'] ?? '8') ?>">
          </div>
          <div class="field">
            <label for="security_submission_rate_window">Aportaciones · ventana (s)</label>
            <input type="text" id="security_submission_rate_window" name="security_submission_rate_window" inputmode="numeric" value="<?= e($s['security_submission_rate_window'] ?? '3600') ?>">
          </div>
        </div>
      </div>
      <button class="btn" type="submit">Guardar seguridad</button>
    </form>
  </section>

  <!-- ============================ GOOGLE ============================ -->
  <section class="tabs__panel" data-panel="google" role="tabpanel">
    <?php if (google_enabled()): ?>
      <div class="alert alert--ok">El acceso con Google está <strong>activado</strong> y el botón aparece en la pantalla de inicio de sesión.</div>
    <?php else: ?>
      <div class="alert alert--info">
        El acceso con Google está <strong>desactivado</strong>. Rellena el <strong>Client ID</strong> y el
        <strong>Client secret</strong> para activarlo. Antes, crea credenciales OAuth 2.0
        (tipo «Aplicación web») en Google Cloud Console y registra la URI de redirección de abajo.
      </div>
    <?php endif; ?>
    <form method="post" action="<?= e(url('admin/settings.php')) ?>">
      <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
      <div class="settings-card">
        <h2>Acceso con Google (OAuth 2.0)</h2>
        <div class="grid-2">
          <div class="field">
            <label for="google_client_id">Client ID de Google</label>
            <input type="text" id="google_client_id" name="google_client_id" value="<?= e($s['google_client_id'] ?? '') ?>" placeholder="xxxxxxxx.apps.googleusercontent.com">
          </div>
          <div class="field">
            <label for="google_client_secret">Client secret de Google</label>
            <input type="password" id="google_client_secret" name="google_client_secret"
                   value="<?= ($s['google_client_secret'] ?? '') !== '' ? '********' : '' ?>" autocomplete="new-password">
            <p class="muted">Deja el valor enmascarado para no cambiarlo.</p>
          </div>
          <div class="field">
            <label>URI de redirección que debes registrar en Google</label>
            <input type="text" readonly value="<?= e(google_redirect_uri()) ?>" onclick="this.select()">
          </div>
          <div class="field">
            <label for="google_redirect_uri">URI de redirección (opcional, si usas otra)</label>
            <input type="text" id="google_redirect_uri" name="google_redirect_uri" value="<?= e($s['google_redirect_uri'] ?? '') ?>" placeholder="(se calcula automáticamente)">
          </div>
        </div>
        <p class="muted">También puedes definirlo en <code>app/config.php</code> (apartado <code>google</code>). Lo guardado aquí tiene prioridad y nunca se expone en la web pública.</p>
      </div>
      <button class="btn" type="submit">Guardar Google</button>
    </form>
  </section>

  <!-- ============================ RUTAS ============================ -->
  <section class="tabs__panel" data-panel="rutas" role="tabpanel">
    <form method="post" action="<?= e(url('admin/settings.php')) ?>">
      <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">
      <div class="settings-card">
        <h2>Rutas del servidor</h2>
        <div class="field">
          <label for="paths_log_dir">Carpeta de registros (logs)</label>
          <input type="text" id="paths_log_dir" name="paths_log_dir" value="<?= e($s['paths_log_dir'] ?? '') ?>" placeholder="<?= e(DATA_DIR) ?>">
          <p class="muted">Vacío = <code>app/data</code>. Aquí se escriben <code>app.log</code> y <code>mail.log</code>. Ruta absoluta recomendada.</p>
        </div>
        <div class="settings-card" style="box-shadow:none;border-style:dashed">
          <h3>Estado del sistema</h3>
          <ul class="muted" style="margin:0;padding-left:1.1rem;line-height:1.8">
            <li>Controlador de base de datos: <strong><?= e(db_driver()) ?></strong></li>
            <li>Carpeta de registros en uso: <code><?= e(log_dir()) ?></code></li>
            <li>PHP: <strong><?= e(PHP_VERSION) ?></strong></li>
          </ul>
        </div>
      </div>
      <button class="btn" type="submit">Guardar rutas</button>
    </form>
  </section>
</div>

<script>
/* Pestañas de Ajustes: muestra la sección elegida sin recargar.
   Se recuerda la última pestaña abierta en la URL (#pestana). */
(function () {
  var root = document.querySelector("[data-tabs]");
  if (!root) return;
  var buttons = Array.prototype.slice.call(root.querySelectorAll(".tabs__btn"));
  var panels  = Array.prototype.slice.call(root.querySelectorAll(".tabs__panel"));

  function activate(name) {
    buttons.forEach(function (b) {
      var on = b.getAttribute("data-tab") === name;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    panels.forEach(function (p) {
      p.classList.toggle("is-active", p.getAttribute("data-panel") === name);
    });
  }

  buttons.forEach(function (b) {
    b.addEventListener("click", function () {
      var name = b.getAttribute("data-tab");
      activate(name);
      if (history.replaceState) history.replaceState(null, "", "#" + name);
    });
  });

  var initial = (location.hash || "").replace("#", "");
  if (initial && buttons.some(function (b) { return b.getAttribute("data-tab") === initial; })) {
    activate(initial);
  }
})();
</script>

<?php admin_footer(); ?>
