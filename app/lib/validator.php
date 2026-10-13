<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  VALIDACION Y SANEAMIENTO DE ENTRADAS
 *  Todo lo que llega del exterior pasa por aqui antes de tocar la base de datos.
 * ============================================================================
 */

/** Quita espacios y caracteres de control. */
function clean_text(string $value): string
{
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '';
    return trim($value);
}

/** Escapa texto para mostrarlo en HTML (defensa en profundidad contra XSS). */
function e(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Resultado de validacion: lista de errores por campo. */
function validate_contact(array $data): array
{
    $errors = [];

    $name    = clean_text((string) ($data['nombre'] ?? ''));
    $email   = clean_text((string) ($data['correo'] ?? ''));
    $phone   = clean_text((string) ($data['teléfono'] ?? ($data['telefono'] ?? '')));
    $service = clean_text((string) ($data['servicio'] ?? ''));
    $message = clean_text((string) ($data['mensaje'] ?? ''));

    if (mb_strlen($name) < 2 || mb_strlen($name) > 120) {
        $errors['nombre'] = 'Escribe tu nombre (entre 2 y 120 caracteres).';
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 190) {
        $errors['correo'] = 'Escribe un correo electronico valido.';
    }
    // Telefono: admite digitos, espacios, + ( ) - y puntos. Entre 6 y 25.
    $digits = preg_replace('/\D/', '', $phone) ?? '';
    if (strlen($digits) < 6 || strlen($digits) > 25 || !preg_match('/^[0-9+\s().\-]+$/', $phone)) {
        $errors['teléfono'] = 'Escribe un telefono valido.';
    }

    $allowedServices = [
        'Desarrollo web y aplicaciones',
        'Automatización y agentes de IA',
        'Soporte técnico',
        'Redes y ciberseguridad',
        'Consultoría tecnológica',
        'Mantenimiento integral',
        'Otro',
    ];
    if ($service === '' || !in_array($service, $allowedServices, true)) {
        $errors['servicio'] = 'Selecciona un servicio.';
    }

    if (mb_strlen($message) < 10 || mb_strlen($message) > 5000) {
        $errors['mensaje'] = 'El mensaje debe tener entre 10 y 5000 caracteres.';
    }

    return [
        'errors' => $errors,
        'data'   => [
            'name'    => $name,
            'email'   => $email,
            'phone'   => $phone,
            'service' => $service,
            'message' => $message,
        ],
    ];
}

/** Normaliza y valida un correo. */
function normalize_email(string $email): ?string
{
    $email = mb_strtolower(clean_text($email));
    return filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null;
}

/** Comprueba la robustez de una contrasena. */
function validate_password(string $password): array
{
    $min    = (int) config('security.password_min', 8);
    $errors = [];
    if (mb_strlen($password) < $min) {
        $errors[] = "La contrasena debe tener al menos $min caracteres.";
    }
    if (!preg_match('/[A-Za-zÁÉÍÓÚÑáéíóúñ]/u', $password)) {
        $errors[] = 'Incluye al menos una letra.';
    }
    if (!preg_match('/\d/', $password)) {
        $errors[] = 'Incluye al menos un numero.';
    }
    return $errors;
}

/** Limita el texto a un maximo de caracteres (para titulares, etc.). */
function limit_text(string $value, int $max): string
{
    $value = clean_text($value);
    if (mb_strlen($value) > $max) {
        $value = mb_substr($value, 0, $max);
    }
    return $value;
}
