<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  CAPTCHA PROPIO  ->  app/lib/captcha.php
 *  Reto aritmetico sencillo, legible y accesible (sin dependencias externas
 *  ni cookies de terceros). El reto se firma con HMAC y caduca, de modo que
 *  no se puede reutilizar ni falsificar desde el cliente.
 *
 *  - captcha_issue():  crea un reto nuevo y devuelve su enunciado + firma.
 *  - captcha_verify(): comprueba la respuesta contra la firma y la caducidad.
 *
 *  Las operaciones se limitan a sumas y restas con resultados pequenos para
 *  que cualquier persona (o lector de pantalla) pueda resolverlas sin friccion.
 * ============================================================================
 */

/** Devuelve un reto nuevo: ['challenge' => '7 + 5 = ?', 'token' => '...'] */
function captcha_issue(): array
{
    $a = random_int(2, 9);
    $b = random_int(2, 9);

    // Mitad sumas, mitad restas (siempre con resultado positivo).
    if (random_int(0, 1) === 0) {
        $question = "$a + $b";
        $answer   = $a + $b;
    } else {
        $hi = max($a, $b);
        $lo = min($a, $b);
        $question = "$hi - $lo";
        $answer   = $hi - $lo;
    }

    return [
        'challenge' => $question . ' = ?',
        'token'     => captcha_sign($answer),
    ];
}

/** Firma la respuesta con HMAC y le anade la marca de tiempo. */
function captcha_sign(int $answer): string
{
    $ts = time();
    $key = (string) config('security.app_key', 'app');
    $mac = hash_hmac('sha256', $answer . '|' . $ts, $key . '|captcha');
    return $ts . '.' . $mac;
}

/**
 * Comprueba la respuesta del usuario contra la firma.
 * Devuelve true solo si el resultado es correcto y no ha caducado.
 */
function captcha_verify(string $token, string $given): bool
{
    $token = trim($token);
    $given = trim($given);
    if ($token === '' || $given === '' || !preg_match('/^-?\d+$/', $given)) {
        return false;
    }

    $parts = explode('.', $token);
    if (count($parts) !== 2) {
        return false;
    }
    [$ts, $mac] = $parts;
    if (!ctype_digit($ts)) {
        return false;
    }

    // Caducidad: 20 minutos para rellenar el formulario.
    $ttl = (int) config('security.captcha_ttl', 1200);
    if (abs(time() - (int) $ts) > $ttl) {
        return false;
    }

    $key      = (string) config('security.app_key', 'app');
    $expected = hash_hmac('sha256', (int) $given . '|' . (int) $ts, $key . '|captcha');

    return hash_equals($expected, $mac);
}
