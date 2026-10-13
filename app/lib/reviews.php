<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  VALORACIONES (RESEÑAS) DE SERVICIOS Y PROYECTOS
 *  Almacenamiento, moderación y agregados. La web pública las consume por
 *  /api/index.php?resource=reviews y las envía por /api/reviews.php.
 * ============================================================================
 */

/** Tipos de destino admitidos para una valoración. */
function review_target_types(): array
{
    return ['servicio', 'proyecto', 'general'];
}

/** Etiquetas legibles de cada estado de moderación. */
function review_status_labels(): array
{
    return [
        'pendiente'  => 'Pendiente',
        'aprobada'   => 'Aprobada',
        'rechazada'  => 'Rechazada',
    ];
}

/** ¿Está activo el módulo de valoraciones? */
function reviews_enabled(): bool
{
    return setting('reviews_enabled', '1') === '1';
}

/** ¿Se publican solas las valoraciones nuevas o hay que moderarlas? */
function reviews_auto_approve(): bool
{
    return setting('reviews_auto_approve', '0') === '1';
}

/* ---------------------------------------------------------------------------
 *  AGREGADOS (usados por la web pública)
 * ------------------------------------------------------------------------- */

/** Media y total de valoraciones aprobadas, opcionalmente por destino. */
function reviews_summary(?string $targetType = null, ?int $targetId = null): array
{
    $sql    = "SELECT COUNT(*) AS total, AVG(rating) AS average FROM reviews WHERE status = 'aprobada'";
    $params = [];
    if ($targetType !== null) {
        $sql .= ' AND target_type = ?';
        $params[] = $targetType;
    }
    if ($targetId !== null) {
        $sql .= ' AND target_id = ?';
        $params[] = $targetId;
    }
    $row = db_one($sql, $params);
    $total = (int) ($row['total'] ?? 0);
    return [
        'total'    => $total,
        'average'  => $total ? round((float) $row['average'], 1) : 0.0,
        'stars'    => $total ? (int) round((float) $row['average']) : 0,
    ];
}

/** Valoraciones aprobadas más recientes para mostrar en la web. */
function reviews_published(string $targetType = '', int $limit = 12): array
{
    $limit = max(1, min(50, $limit));
    if ($targetType !== '' && in_array($targetType, review_target_types(), true)) {
        $rows = db_all(
            "SELECT id, target_type, target_id, target_label, rating, author_name, comment, created_at
               FROM reviews WHERE status = 'aprobada' AND target_type = ?
              ORDER BY created_at DESC, id DESC LIMIT $limit",
            [$targetType]
        );
    } else {
        $rows = db_all(
            "SELECT id, target_type, target_id, target_label, rating, author_name, comment, created_at
               FROM reviews WHERE status = 'aprobada'
              ORDER BY created_at DESC, id DESC LIMIT $limit"
        );
    }
    return $rows;
}

/* ---------------------------------------------------------------------------
 *  MODERACIÓN (panel)
 * ------------------------------------------------------------------------- */

/** Valoraciones para el panel, con filtro opcional por estado. */
function reviews_for_admin(string $status = ''): array
{
    if ($status !== '' && isset(review_status_labels()[$status])) {
        return db_all('SELECT * FROM reviews WHERE status = ? ORDER BY created_at DESC, id DESC LIMIT 500', [$status]);
    }
    return db_all('SELECT * FROM reviews ORDER BY ' . "CASE status WHEN 'pendiente' THEN 0 WHEN 'aprobada' THEN 1 ELSE 2 END, created_at DESC" . ' LIMIT 500');
}

/** Cambia el estado de moderación de una valoración. */
function review_set_status(int $id, string $status): bool
{
    if ($id <= 0 || !isset(review_status_labels()[$status])) {
        return false;
    }
    db_update('reviews', ['status' => $status], 'id = :id', ['id' => $id]);
    return true;
}

/* ---------------------------------------------------------------------------
 *  TRUSTPILOT: reseñas reales de la ficha publica (sin API key)
 * ------------------------------------------------------------------------- */

/**
 * Extrae el dominio reseñable (identificador de la ficha) de la URL de Trustpilot.
 * Ej.: "https://es.trustpilot.com/review/miempresa.com" -> "miempresa.com".
 */
function trustpilot_domain(): string
{
    $url = trim((string) setting('trustpilot_url', ''));
    if ($url === '' || !filter_var($url, FILTER_VALIDATE_URL)) {
        return '';
    }
    $path = trim((string) parse_url($url, PHP_URL_PATH), '/'); // p. ej. "review/miempresa.com"
    $parts = explode('/', $path);
    $domain = end($parts) ?: '';
    // Limpia parametros y deja solo caracteres validos de dominio.
    $domain = preg_replace('/[^A-Za-z0-9.\-]/', '', $domain) ?? '';
    return $domain;
}

/** ¿Está configurada la integración con Trustpilot? */
function trustpilot_enabled(): bool
{
    return (string) setting('reviews_provider', 'custom') === 'trustpilot'
        && trustpilot_domain() !== '';
}

/**
 * Descarga las reseñas publicas de la ficha de Trustpilot.
 * Cachea el resultado 6 horas en la tabla settings para no llamar en cada visita.
 * Devuelve ['ok'=>bool, 'source'=>'trustpilot', 'summary'=>[...], 'items'=>[...]].
 */
function trustpilot_fetch(bool $force = false): array
{
    $empty = ['ok' => false, 'source' => 'trustpilot', 'summary' => ['total' => 0, 'average' => 0, 'stars' => 0, 'trustscore' => 0], 'items' => []];
    $domain = trustpilot_domain();
    if ($domain === '') {
        return $empty;
    }

    $cacheKey = 'trustpilot_cache_' . md5($domain);
    $cacheTtl = 6 * 3600;
    if (!$force) {
        $cached = db_one('SELECT svalue, updated_at FROM settings WHERE skey = ?', [$cacheKey]);
        if ($cached && strtotime((string) $cached['updated_at']) > time() - $cacheTtl) {
            $decoded = json_decode((string) $cached['svalue'], true);
            if (is_array($decoded)) {
                $decoded['cached'] = true;
                return $decoded;
            }
        }
    }

    $res  = http_get_with_status('https://es.trustpilot.com/review/' . rawurlencode($domain));
    $html = $res['body'];
    if ($res['status'] !== 200 || !is_string($html) || $html === '') {
        app_log('Trustpilot: respuesta ' . $res['status'] . ' para ' . $domain);
        return $empty;
    }

    $data = trustpilot_parse($html);
    if ($data['summary']['total'] === 0) {
        app_log('Trustpilot: no se encontraron reseñas en el HTML de ' . $domain);
        return $empty;
    }

    setting_set($cacheKey, json_encode($data, JSON_UNESCAPED_UNICODE));
    $data['cached'] = false;
    return $data;
}

/**
 * Extrae la nota media, el TrustScore y las reseñas del HTML publico.
 * Usa el JSON-LD que Trustpilot incluye en todas sus fichas.
 */
function trustpilot_parse(string $html): array
{
    $summary = ['total' => 0, 'average' => 0, 'stars' => 0, 'trustscore' => 0];
    $items   = [];

    if (preg_match_all('#<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>#is', $html, $m)) {
        foreach ($m[1] as $raw) {
            $json = json_decode(trim($raw), true);
            if (!is_array($json)) {
                continue;
            }
            foreach ((isset($json[0]) ? $json : [$json]) as $node) {
                if (!is_array($node) || ($node['@type'] ?? '') !== 'LocalBusiness') {
                    continue;
                }
                $agg = $node['aggregateRating'] ?? null;
                if (is_array($agg)) {
                    $summary['total']       = (int) ($agg['ratingCount'] ?? $agg['reviewCount'] ?? 0);
                    $summary['average']     = round((float) ($agg['ratingValue'] ?? 0), 1);
                    $summary['stars']       = (int) round($summary['average']);
                }
                // TrustScore (escala 0-5) si viene en additionalProperty.
                foreach ((array) ($node['additionalProperty'] ?? []) as $prop) {
                    if (($prop['name'] ?? '') === 'TrustScore') {
                        $summary['trustscore'] = (float) ($prop['value'] ?? 0);
                    }
                }
                foreach ((array) ($node['review'] ?? []) as $rev) {
                    if (!is_array($rev)) {
                        continue;
                    }
                    $rating = $rev['reviewRating']['ratingValue'] ?? 5;
                    $items[] = [
                        'author_name' => (string) ($rev['author']['name'] ?? 'Cliente'),
                        'rating'      => (int) round((float) $rating),
                        'comment'     => trim((string) ($rev['reviewBody'] ?? $rev['description'] ?? '')),
                        'title'       => trim((string) ($rev['headline'] ?? $rev['name'] ?? '')),
                        'created_at'  => (string) ($rev['datePublished'] ?? ''),
                        'url'         => (string) ($node['url'] ?? ''),
                    ];
                }
            }
        }
    }

    // Respaldo: TrustScore del bloque de resumen si el JSON-LD no lo trae.
    if ($summary['trustscore'] === 0
        && preg_match('#"trustScore"\s*:\s*([0-9.]+)#', $html, $ts)) {
        $summary['trustscore'] = (float) $ts[1];
    }

    $summary['average'] = round($summary['average'], 1);
    return ['ok' => $summary['total'] > 0, 'source' => 'trustpilot', 'summary' => $summary, 'items' => $items];
}
