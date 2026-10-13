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
        $fields = settings_editable();
        foreach ($fields as $key) {
            if (array_key_exists($key, $_POST)) {
                $value = clean_text((string) $_POST[$key]);
                // El embed del mapa admite HTML de iframe: guardamos solo la URL src si es iframe.
                if ($key === 'mapa_embed') {
                    $value = sanitize_map_embed($value);
                } elseif (in_array($key, ['facebook', 'instagram', 'linkedin', 'github', 'google_maps_url'], true)) {
                    $value = sanitize_url($value);
                }
                setting_set($key, $value);
            }
        }
        $flash = ['ok', 'Ajustes guardados.'];
        audit('settings_updated');
    }
}

$s = settings_all();

/** Limpia una URL (permite vacio o http/https). */
function sanitize_url(string $value): string
{
    $value = trim($value);
    if ($value === '' || in_array($value, ['[URL_FACEBOOK]', '[URL_INSTAGRAM]', '[URL_LINKEDIN]', '[URL_GITHUB]'], true)) {
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

admin_header('Ajustes');
?>
<h1>Ajustes del sitio</h1>

<?php if ($flash): ?>
  <div class="alert alert--<?= e($flash[0]) ?>"><?= e($flash[1]) ?></div>
<?php endif; ?>

<form method="post" action="<?= e(url('admin/settings.php')) ?>">
  <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>">

  <h2>Contacto</h2>
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
      <label for="correo">Correo electrónico</label>
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

  <h2>Mapa</h2>
  <div class="field">
    <label for="mapa_embed">URL del mapa (Google Maps embed)</label>
    <input type="text" id="mapa_embed" name="mapa_embed" value="<?= e($s['mapa_embed'] ?? '') ?>"
           placeholder="https://www.google.com/maps/embed?pb=...">
    <p class="muted">Pega aquí la URL que da Google Maps en «Compartir → Insertar un mapa».
    Si lo dejas vacío, la web muestra la imagen de mapa por defecto.</p>
  </div>
  <div class="field">
    <label for="google_maps_url">Enlace «Cómo llegar»</label>
    <input type="text" id="google_maps_url" name="google_maps_url" value="<?= e($s['google_maps_url'] ?? '') ?>">
  </div>

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

  <button class="btn" type="submit">Guardar ajustes</button>
</form>

<h2>Vista previa del mapa</h2>
<?php $embed = (string) ($s['mapa_embed'] ?? ''); ?>
<?php if ($embed !== '' && preg_match('#^https://#', $embed)): ?>
  <iframe src="<?= e($embed) ?>" width="100%" height="320" style="border:0;border-radius:14px" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
<?php else: ?>
  <div class="alert alert--info">Sin mapa configurado: la web usará la imagen de mapa por defecto.</div>
<?php endif; ?>
<?php admin_footer(); ?>
