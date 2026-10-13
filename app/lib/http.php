<?php
declare(strict_types=1);

/**
 * Cliente HTTP minimo con cURL (para Google OAuth).
 */

/** Peticion GET que devuelve el cuerpo como cadena (o null). */
function http_get(string $url, array $headers = []): ?string
{
    return http_request('GET', $url, [], $headers);
}

/** Peticion POST tipo formulario. */
function http_post(string $url, array $fields, array $headers = []): ?string
{
    return http_request('POST', $url, $fields, $headers);
}

/**
 * Peticion GET que devuelve tambien el codigo HTTP (para depurar y distinguir
 * "sin datos" de "error"). Devuelve ['status' => int, 'body' => ?string].
 */
function http_get_with_status(string $url, array $headers = []): array
{
    if (!function_exists('curl_init')) {
        return ['status' => 0, 'body' => null];
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 3,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_HTTPHEADER     => array_merge(['Accept: application/json'], $headers),
    ]);
    $body   = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($body === false) {
        app_log('HTTP GET fallo: ' . curl_error($ch));
        $body = null;
    }
    curl_close($ch);
    return ['status' => $status, 'body' => is_string($body) ? $body : null];
}

function http_request(string $method, string $url, array $fields = [], array $headers = []): ?string
{
    if (!function_exists('curl_init')) {
        app_log('cURL no disponible');
        return null;
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 3,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_HTTPHEADER     => array_merge(['Accept: application/json'], $headers),
    ]);

    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($fields));
    }

    $body = curl_exec($ch);
    if ($body === false) {
        app_log('HTTP ' . $method . ' fallo: ' . curl_error($ch));
        $body = null;
    }
    curl_close($ch);

    return is_string($body) ? $body : null;
}
