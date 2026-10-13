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
