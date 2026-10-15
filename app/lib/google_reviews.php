<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  RESEÑAS DE GOOGLE EN VIVO (con caché en base de datos)
 * ----------------------------------------------------------------------------
 *  Trae las reseñas reales de la ficha de Google del negocio (Google Places
 *  API, que tiene plan gratuito) y las guarda en la tabla "google_reviews".
 *
 *  Comportamiento:
 *   - Si hay conexión, se consultan las reseñas y se cachean.
 *   - Si la conexión falla, se devuelven las ÚLTIMAS 3 guardadas en la BD,
 *     de modo que la web nunca se queda sin reseñas.
 *   - Cuando la conexión vuelve, la siguiente petición actualiza la caché.
 *
 *  Requiere dos ajustes (panel · Ajustes · Reseñas):
 *   - google_places_api_key : clave de la API (se guarda enmascarada).
 *   - google_place_id       : identificador de la ficha (place_id) del negocio.
 *
 *  La clave NUNCA se envía al navegador: la consulta se hace en el servidor.
 * ============================================================================
 */

/** Identificador (place_id) de la ficha de Google del negocio. */
function google_reviews_place_id(): string
{
    return trim((string) setting('google_place_id', ''));
}

/** Clave de la API de Google Places (solo se usa en el servidor). */
function google_reviews_api_key(): string
{
    return trim((string) setting('google_places_api_key', ''));
}

/** ¿Está configurada la integración con Google? */
function google_reviews_enabled(): bool
{
    return google_reviews_place_id() !== '' && google_reviews_api_key() !== '';
}

/** Tiempo (segundos) que se conserva la caché antes de volver a consultar. */
function google_reviews_ttl(): int
{
    $ttl = (int) setting('google_reviews_cache_ttl', '21600'); // 6 horas por defecto
    return $ttl > 0 ? $ttl : 21600;
}

/** Crea la tabla de caché si no existe (se llama de forma perezosa). */
function google_reviews_table_init(): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $done  = true;
    $mysql = db_driver() === 'mysql';
    $serial = $mysql ? 'INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    $str    = $mysql ? 'VARCHAR(255)' : 'TEXT';
    $engine = $mysql ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '';

    db()->exec("CREATE TABLE IF NOT EXISTS google_reviews (
        id $serial,
        review_key $str NOT NULL,
        author $str DEFAULT '',
        rating INT NOT NULL DEFAULT 5,
        body TEXT DEFAULT NULL,
        photo VARCHAR(500) DEFAULT '',
        profile_url VARCHAR(500) DEFAULT '',
        relative_time $str DEFAULT '',
        sort_ts INT NOT NULL DEFAULT 0,
        fetched_at DATETIME DEFAULT NULL
    ) $engine");

    try {
        db()->exec('CREATE UNIQUE INDEX idx_google_reviews_key ON google_reviews (review_key)');
    } catch (Throwable $e) {
        // El índice ya existe: continuamos.
    }
}

/**
 * Devuelve las últimas reseñas guardadas en la base de datos.
 * Se usa como respaldo cuando no hay conexión (las últimas 3 que se leyeron).
 */
function google_reviews_cached(int $limit = 3): array
{
    google_reviews_table_init();
    $limit = max(1, min(20, $limit));
    $rows  = db_all(
        "SELECT author, rating, body, photo, profile_url, relative_time, sort_ts, fetched_at
           FROM google_reviews ORDER BY sort_ts DESC, id DESC LIMIT $limit"
    );
    $items = [];
    foreach ($rows as $r) {
        $items[] = [
            'author_name'   => (string) $r['author'],
            'rating'        => (int) $r['rating'],
            'comment'       => (string) $r['body'],
            'relative_time' => (string) $r['relative_time'],
            'photo'         => (string) $r['photo'],
            'profile_url'   => (string) $r['profile_url'],
            'created_at'    => (string) $r['sort_ts'],
        ];
    }
    return $items;
}

/** Nota media y total de reseñas cacheados (o valores por defecto). */
function google_reviews_summary_cached(): array
{
    $raw = (string) setting('google_reviews_summary', '');
    $dec = $raw !== '' ? json_decode($raw, true) : null;
    if (!is_array($dec)) {
        $dec = ['average' => 0, 'total' => 0, 'stars' => 0];
    }
    return [
        'average' => (float) ($dec['average'] ?? 0),
        'total'   => (int) ($dec['total'] ?? 0),
        'stars'   => (int) ($dec['stars'] ?? 0),
    ];
}

/**
 * Consulta la API de Google Places y devuelve las reseñas.
 * Devuelve ['ok'=>bool, 'items'=>[], 'summary'=>[], 'error'=>?string].
 */
function google_reviews_request(): array
{
    $place = google_reviews_place_id();
    $key   = google_reviews_api_key();
    if ($place === '' || $key === '') {
        return ['ok' => false, 'items' => [], 'summary' => [], 'error' => 'sin_configurar'];
    }

    $url = 'https://maps.googleapis.com/maps/api/place/details/json'
        . '?place_id=' . rawurlencode($place)
        . '&fields=' . rawurlencode('name,rating,user_ratings_total,reviews')
        . '&language=es&reviews_sort=newest'
        . '&key=' . rawurlencode($key);

    $res = http_get_with_status($url);
    if ($res['status'] !== 200 || !is_string($res['body']) || $res['body'] === '') {
        app_log('Google Reviews: sin respuesta (status ' . $res['status'] . ')');
        return ['ok' => false, 'items' => [], 'summary' => [], 'error' => 'sin_conexion'];
    }

    $data = json_decode($res['body'], true);
    if (!is_array($data) || (($data['status'] ?? '') !== 'OK')) {
        app_log('Google Reviews: respuesta ' . (is_array($data) ? ($data['status'] ?? '?') : 'invalida'));
        return ['ok' => false, 'items' => [], 'summary' => [], 'error' => (string) ($data['status'] ?? 'respuesta_invalida')];
    }

    $result  = is_array($data['result'] ?? null) ? $data['result'] : [];
    $items   = [];
    foreach ((array) ($result['reviews'] ?? []) as $rev) {
        if (!is_array($rev)) {
            continue;
        }
        $items[] = [
            'author_name'   => (string) ($rev['author_name'] ?? 'Cliente'),
            'rating'        => (int) round((float) ($rev['rating'] ?? 5)),
            'comment'       => trim((string) ($rev['text'] ?? '')),
            'relative_time' => (string) ($rev['relative_time_description'] ?? ''),
            'photo'         => (string) ($rev['profile_photo_url'] ?? ''),
            'profile_url'   => (string) ($rev['author_url'] ?? ''),
            'time'          => (int) ($rev['time'] ?? time()),
        ];
    }

    $average = round((float) ($result['rating'] ?? 0), 1);
    $summary = [
        'average' => $average,
        'total'   => (int) ($result['user_ratings_total'] ?? count($items)),
        'stars'   => (int) round($average),
    ];

    return ['ok' => true, 'items' => $items, 'summary' => $summary, 'error' => null];
}

/** Guarda (o actualiza) las reseñas y la media en la base de datos. */
function google_reviews_store(array $items, array $summary): void
{
    google_reviews_table_init();
    $now = date('Y-m-d H:i:s');

    foreach ($items as $it) {
        $key = md5((string) $it['author_name'] . '|' . (int) ($it['time'] ?? 0) . '|' . (string) $it['comment']);
        $row = db_one('SELECT id FROM google_reviews WHERE review_key = ?', [$key]);
        $data = [
            'review_key'    => $key,
            'author'        => (string) $it['author_name'],
            'rating'        => (int) $it['rating'],
            'body'          => (string) $it['comment'],
            'photo'         => (string) $it['photo'],
            'profile_url'   => (string) $it['profile_url'],
            'relative_time' => (string) $it['relative_time'],
            'sort_ts'       => (int) ($it['time'] ?? time()),
            'fetched_at'    => $now,
        ];
        if ($row) {
            db_update('google_reviews', $data, 'id = :id', ['id' => (int) $row['id']]);
        } else {
            db_insert('google_reviews', $data);
        }
    }

    // Poda: conservamos solo las 20 más recientes (basta para mostrar 3).
    $keep = db_all('SELECT id FROM google_reviews ORDER BY sort_ts DESC, id DESC LIMIT 20');
    if ($keep) {
        $ids = array_map(fn($r) => (int) $r['id'], $keep);
        $ph  = implode(',', array_fill(0, count($ids), '?'));
        db_query("DELETE FROM google_reviews WHERE id NOT IN ($ph)", $ids);
    }

    setting_set('google_reviews_summary', json_encode($summary, JSON_UNESCAPED_UNICODE));
    setting_set('google_reviews_fetched_at', $now);
}

/**
 * Punto de entrada: devuelve las reseñas (en vivo si se puede; si no, caché).
 *
 * @param bool $force Fuerza la consulta a Google ignorando el TTL de la caché.
 */
function google_reviews_fetch(bool $force = false): array
{
    google_reviews_table_init();
    $enabled   = google_reviews_enabled();
    $cached    = google_reviews_cached(3);
    $updatedAt = (string) setting('google_reviews_fetched_at', '');

    $out = [
        'ok'         => true,
        'enabled'    => $enabled,
        'live'       => false,
        'cached'     => !empty($cached),
        'stale'      => false,
        'updated_at' => $updatedAt,
        'summary'    => google_reviews_summary_cached(),
        'items'      => $cached,
    ];

    if (!$enabled) {
        return $out; // Sin credenciales: la web mantiene su contenido estático.
    }

    // Si la caché está fresca y no se fuerza, servimos de base de datos.
    $fresh = $updatedAt !== '' && (time() - (int) strtotime($updatedAt)) < google_reviews_ttl();
    if (!$force && $fresh) {
        return $out;
    }

    $res = google_reviews_request();
    if (!$res['ok']) {
        // Sin conexión: devolvemos las últimas 3 guardadas y marcamos "stale".
        $out['stale'] = !empty($cached);
        $out['error'] = $res['error'];
        return $out;
    }

    google_reviews_store($res['items'], $res['summary']);
    $out['live']       = true;
    $out['cached']     = true;
    $out['stale']      = false;
    $out['summary']    = $res['summary'];
    $out['items']      = google_reviews_cached(3);
    $out['updated_at'] = (string) setting('google_reviews_fetched_at', '');
    return $out;
}

/** Fuerza una actualización inmediata (botón del panel). */
function google_reviews_refresh(): array
{
    return google_reviews_fetch(true);
}

/** Enlace a la ficha del negocio en Google Maps (para botones «Ver en Google»). */
function google_reviews_place_url(): string
{
    $place = google_reviews_place_id();
    if ($place !== '') {
        return 'https://www.google.com/maps/search/?api=1&query_place_id=' . rawurlencode($place);
    }
    return (string) setting('google_maps_url', '');
}
