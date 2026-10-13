<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  PREGUNTAS FRECUENTES E IMPORTANCIA
 *  ----------------------------------------------------------------------------
 *  Las preguntas pueden venir de dos sitios:
 *    - content_items (ctype = 'faq')  -> base gestionada en el panel.
 *    - user_submissions (stype = 'pregunta') -> propuestas de usuarios registrados.
 *
 *  ALGORITMO DE IMPORTANCIA (0-100)
 *  Ordena las preguntas para decidir cuáles se muestran en la portada. Es una
 *  suma ponderada, transparente y editable, de cuatro señales:
 *
 *    1) Peso manual (score)        -> 0-40 ptos  (máximo 5 x 8)
 *    2) Demanda de los usuarios    -> 0-35 ptos  (cuántos usuarios preguntan lo mismo)
 *    3) Relevancia del canal       -> 0-15 ptos  (preguntas de usuarios verificados)
 *    4) Frescura                   -> 0-10 ptos  (penaliza lo muy antiguo)
 *
 *  total = 8·score + 35·(1 - e^(-peticiones/umbral)) + 15·(canal) + 10·(frescura)
 *
 *  'peticiones' = nº de preguntas de usuarios que comparten la misma huella
 *  (texto normalizado). Así, cuando varias personas preguntan lo mismo, la
 *  pregunta gana importancia automáticamente.
 * ============================================================================
 */

/** Normaliza un texto para agrupar preguntas equivalentes. */
function faq_fingerprint(string $text): string
{
    $text = mb_strtolower(clean_text($text));
    // Quita signos de apertura/cierre y de puntuación sobrantes.
    $text = preg_replace('/[¿?¡!.,;:"\'`´()\[\]{}]/u', ' ', $text) ?? $text;
    // Colapsa espacios (incluye acentos combinados básicos).
    $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
    $text = trim($text);
    // Acorta para que "¿cuánto cuesta un proyecto?" y "cuanto cuesta el proyecto"
    // se consideren parecidos sin disparar falsos positivos.
    return mb_substr($text, 0, 80);
}

/** Cuenta las peticiones de usuarios por huella normalizada. */
function faq_demand_counts(): array
{
    $rows = db_all("SELECT title FROM user_submissions WHERE stype = 'pregunta'");
    $counts = [];
    foreach ($rows as $r) {
        $fp = faq_fingerprint((string) $r['title']);
        if ($fp === '') {
            continue;
        }
        $counts[$fp] = ($counts[$fp] ?? 0) + 1;
    }
    return $counts;
}

/**
 * Calcula la puntuación de importancia (0-100) de una pregunta.
 *
 * @param array $faq  ['score'=>int, 'peticiones'=>int, 'fuente'=>'panel'|'usuario', 'created_at'=>string]
 */
function faq_importance(array $faq): float
{
    $maxWeight  = (float) config('faq.weight_weight', 8);      // 5 x 8 = 40
    $demandMax  = (float) config('faq.weight_demand', 35);
    $channelMax = (float) config('faq.weight_channel', 15);    // usuarios verificados
    $freshMax   = (float) config('faq.weight_freshness', 10);

    $score  = max(0, min(5, (int) ($faq['score'] ?? 0)));
    $demand = max(0, (int) ($faq['peticiones'] ?? 0));

    // 1) Peso manual.
    $w = $score * $maxWeight;

    // 2) Demanda: saturación exponencial. Con 'demand_threshold' peticiones
    //    alcanza ~63% del máximo; nunca lo supera (evita que una sola pregunta
    //    monopolice la portada solo por repetirse).
    $threshold = max(1.0, (float) config('faq.demand_threshold', 3));
    $d = ($demand > 0) ? $demandMax * (1 - exp(-$demand / $threshold)) : 0.0;

    // 3) Canal: las preguntas propuestas por usuarios registrados tienen más
    //    señal de interés real. La base del panel también puntúa (0.6).
    $channel = ($faq['fuente'] ?? 'panel') === 'usuario' ? 1.0 : 0.6;
    $c = $channelMax * $channel;

    // 4) Frescura: 10 ptos si es reciente; decae con una vida media de ~180 días.
    $created = (string) ($faq['created_at'] ?? '');
    $ageDays = $created !== '' ? max(0, (time() - (int) strtotime($created)) / 86400) : 3650;
    $halfLife = max(1.0, (float) config('faq.freshness_halflife_days', 180));
    $f = $freshMax * pow(0.5, $ageDays / $halfLife);

    return round(min(100.0, $w + $d + $c + $f), 1);
}

/**
 * Devuelve las preguntas activas ordenadas por importancia (de mayor a menor).
 * Cada elemento incluye: id, title, body, fuente, score, peticiones e importance.
 */
function faqs_ranked(bool $onlyPublished = true): array
{
    $demand = faq_demand_counts();
    $faqs   = [];

    // A) Preguntas de la base (panel).
    foreach (db_all('SELECT id, title, body, score, created_at FROM content_items WHERE ctype = ? ORDER BY sort_order ASC, id ASC', ['faq']) as $f) {
        $fp = faq_fingerprint((string) $f['title']);
        $faqs[] = [
            'id'         => (int) $f['id'],
            'title'      => (string) $f['title'],
            'body'       => (string) $f['body'],
            'fuente'     => 'panel',
            'score'      => (int) $f['score'],
            'peticiones' => (int) ($demand[$fp] ?? 0),
            'created_at' => (string) $f['created_at'],
        ];
    }

    // B) Preguntas propuestas por usuarios registrados (agrupadas por huella).
    $rows = db_all("SELECT id, title, body, score, created_at, status FROM user_submissions WHERE stype = 'pregunta' ORDER BY created_at DESC");
    $seen = [];
    foreach ($rows as $r) {
        $fp = faq_fingerprint((string) $r['title']);
        if ($fp === '' || isset($seen[$fp])) {
            continue; // nos quedamos con la más reciente de cada pregunta repetida
        }
        if ($onlyPublished && ($r['status'] !== 'aprobada')) {
            // Las pendientes no se publican, pero ya cuentan para la demanda
            // de la pregunta equivalente de la base.
            $seen[$fp] = true;
            continue;
        }
        $seen[$fp] = true;
        $faqs[] = [
            'id'         => (int) $r['id'],
            'title'      => (string) $r['title'],
            'body'       => (string) $r['body'],
            'fuente'     => 'usuario',
            'score'      => (int) $r['score'],
            'peticiones' => (int) ($demand[$fp] ?? 0),
            'created_at' => (string) $r['created_at'],
        ];
    }

    foreach ($faqs as &$f) {
        $f['importance'] = faq_importance($f);
    }
    unset($f);

    usort($faqs, function ($a, $b) {
        return $b['importance'] <=> $a['importance'];
    });
    return $faqs;
}

/** Preguntas más relevantes para la portada (limitadas y por encima del umbral). */
function faqs_top(int $limit = 6): array
{
    $limit     = max(1, min(20, $limit));
    $minScore  = (float) config('faq.portal_min_score', 20);
    $ranked    = faqs_ranked();
    $out       = [];
    foreach ($ranked as $f) {
        if ($f['importance'] >= $minScore) {
            $out[] = $f;
        }
        if (count($out) >= $limit) {
            break;
        }
    }
    // Si por umbral no hubiera ninguna, mostramos las mejor puntuadas igualmente.
    if (!$out) {
        $out = array_slice($ranked, 0, $limit);
    }
    return $out;
}
