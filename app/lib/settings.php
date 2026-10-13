<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  AJUSTES DEL SITIO
 *  Clave/valor en la tabla "settings"; los usa el panel y la API publica.
 * ============================================================================
 */

/** Devuelve todos los ajustes como array asociativo. */
function settings_all(): array
{
    $rows = db_all('SELECT skey, svalue FROM settings');
    $out  = [];
    foreach ($rows as $row) {
        $out[$row['skey']] = $row['svalue'];
    }
    // Rellena con los valores por defecto que falten.
    return array_merge(config('defaults') ?? [], $out);
}

/** Devuelve un ajuste concreto. */
function setting(string $key, $default = ''): string
{
    $row = db_one('SELECT svalue FROM settings WHERE skey = ?', [$key]);
    if ($row) {
        return (string) $row['svalue'];
    }
    return (string) (config('defaults.' . $key, $default));
}

/** Guarda (o crea) un ajuste. */
function setting_set(string $key, string $value): void
{
    $exists = db_one('SELECT skey FROM settings WHERE skey = ?', [$key]);
    if ($exists) {
        db_update('settings', ['svalue' => $value, 'updated_at' => date('Y-m-d H:i:s')], 'skey = :skey', ['skey' => $key]);
    } else {
        db_insert('settings', ['skey' => $key, 'svalue' => $value, 'updated_at' => date('Y-m-d H:i:s')]);
    }
}

/** Ajustes que se pueden editar desde el panel (lista blanca). */
function settings_editable(): array
{
    return [
        'telefono', 'whatsapp', 'correo', 'direccion', 'ciudad', 'horario',
        'mapa_embed', 'google_maps_url',
        'facebook', 'instagram', 'linkedin', 'github',
    ];
}

/** Datos publicos que expone la web (subconjunto de ajustes). */
function settings_public(): array
{
    $all = settings_all();
    $out = [];
    foreach ($all as $key => $value) {
        $out[$key] = $value;
    }
    return $out;
}
