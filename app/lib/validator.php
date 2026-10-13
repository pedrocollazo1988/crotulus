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
        $errors['correo'] = 'Escribe un correo electrónico válido.';
    }
    // Telefono: admite digitos, espacios, + ( ) - y puntos. Entre 6 y 25.
    $digits = preg_replace('/\D/', '', $phone) ?? '';
    if (strlen($digits) < 6 || strlen($digits) > 25 || !preg_match('/^[0-9+\s().\-]+$/', $phone)) {
        $errors['teléfono'] = 'Escribe un teléfono válido.';
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
    $max    = (int) config('security.password_max', 200);
    $errors = [];
    if ($password === '') {
        return ['Escribe una contraseña.'];
    }
    if (mb_strlen($password) < $min) {
        $errors[] = "La contraseña debe tener al menos $min caracteres.";
    }
    if (mb_strlen($password) > $max) {
        $errors[] = "La contraseña no puede superar los $max caracteres.";
    }
    if (!preg_match('/[A-Za-zÁÉÍÓÚÑáéíóúñ]/u', $password)) {
        $errors[] = 'Incluye al menos una letra.';
    }
    if (!preg_match('/\d/', $password)) {
        $errors[] = 'Incluye al menos un número.';
    }
    return $errors;
}

/** Comprueba el nombre de una persona. */
function validate_name(string $name): array
{
    $name   = clean_text($name);
    $errors = [];
    if (mb_strlen($name) < 2) {
        $errors[] = 'Escribe tu nombre (mínimo 2 caracteres).';
    } elseif (mb_strlen($name) > 120) {
        $errors[] = 'El nombre no puede superar los 120 caracteres.';
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

/**
 * Valida una valoración de servicio o proyecto enviada desde la web.
 * Devuelve ['data' => [...], 'errors' => [campo => mensaje]].
 */
function validate_review(array $data): array
{
    $errors = [];

    $targetType = clean_text((string) ($data['tipo'] ?? ($data['target_type'] ?? 'general')));
    $rating     = (int) ($data['valoracion'] ?? ($data['rating'] ?? 0));
    $name       = clean_text((string) ($data['nombre'] ?? ($data['author_name'] ?? '')));
    $email      = clean_text((string) ($data['correo'] ?? ($data['author_email'] ?? '')));
    $comment    = clean_text((string) ($data['comentario'] ?? ($data['comment'] ?? '')));
    $label      = clean_text((string) ($data['etiqueta'] ?? ($data['target_label'] ?? '')));
    $targetId   = (int) ($data['destino_id'] ?? ($data['target_id'] ?? 0));

    if (!in_array($targetType, review_target_types(), true)) {
        $targetType = 'general';
    }
    if ($rating < 1 || $rating > 5) {
        $errors['valoracion'] = 'Elige una puntuación entre 1 y 5 estrellas.';
    }
    if (mb_strlen($name) < 2 || mb_strlen($name) > 120) {
        $errors['nombre'] = 'Escribe tu nombre (entre 2 y 120 caracteres).';
    }
    // El correo es opcional, pero si viene debe ser válido (no se publica).
    if ($email !== '' && (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 190)) {
        $errors['correo'] = 'Escribe un correo electrónico válido o déjalo vacío.';
    }
    if (mb_strlen($comment) < 10 || mb_strlen($comment) > 1500) {
        $errors['comentario'] = 'Cuéntanos tu experiencia (entre 10 y 1500 caracteres).';
    }

    return [
        'errors' => $errors,
        'data'   => [
            'target_type'  => $targetType,
            'target_id'    => max(0, $targetId),
            'target_label' => limit_text($label, 200),
            'rating'       => max(1, min(5, $rating)),
            'author_name'  => $name,
            'author_email' => $email,
            'comment'      => $comment,
        ],
    ];
}
