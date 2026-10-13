<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  APORTACIONES DE USUARIOS REGISTRADOS
 *  ----------------------------------------------------------------------------
 *  Testimonios y preguntas frecuentes que envían las personas con sesión
 *  iniciada. Se guardan en "user_submissions" y se moderan en el panel.
 *    - Los testimonios aprobados se publican en la sección de testimonios.
 *    - Las preguntas alimentan el algoritmo de importancia de las FAQ.
 * ============================================================================
 */

/** Tipos de aportación admitidos. */
function submission_types(): array
{
    return ['testimonio' => 'Testimonio', 'pregunta' => 'Pregunta frecuente'];
}

/** Estados de moderación. */
function submission_status_labels(): array
{
    return ['pendiente' => 'Pendiente', 'aprobada' => 'Aprobada', 'rechazada' => 'Rechazada'];
}

/** ¿Está activo el módulo de aportaciones? */
function submissions_enabled(): bool
{
    return setting('submissions_enabled', '1') === '1';
}

/** ¿Se publican solas las aportaciones nuevas o hay que moderarlas? */
function submissions_auto_approve(): bool
{
    return setting('submissions_auto_approve', '0') === '1';
}

/** Etiqueta del tipo de aportación. */
function submission_type_label(string $type): string
{
    return submission_types()[$type] ?? $type;
}

/** Aportaciones de un usuario (para que vea su estado en la web). */
function submissions_for_user(int $userId, int $limit = 20): array
{
    $limit = max(1, min(100, $limit));
    return db_all(
        "SELECT id, stype, title, body, status, created_at
           FROM user_submissions WHERE user_id = ?
          ORDER BY created_at DESC LIMIT $limit",
        [$userId]
    );
}

/** Aportaciones para el panel, con filtros opcionales por tipo y estado. */
function submissions_for_admin(string $type = '', string $status = ''): array
{
    $sql    = 'SELECT s.*, u.name AS user_name, u.email AS user_email
                 FROM user_submissions s LEFT JOIN users u ON u.id = s.user_id WHERE 1=1';
    $params = [];
    if ($type !== '' && isset(submission_types()[$type])) {
        $sql .= ' AND s.stype = ?';
        $params[] = $type;
    }
    if ($status !== '' && isset(submission_status_labels()[$status])) {
        $sql .= ' AND s.status = ?';
        $params[] = $status;
    }
    $sql .= " ORDER BY CASE s.status WHEN 'pendiente' THEN 0 WHEN 'aprobada' THEN 1 ELSE 2 END, s.created_at DESC LIMIT 500";
    return db_all($sql, $params);
}

/** Cambia el estado de moderación de una aportación. */
function submission_set_status(int $id, string $status): bool
{
    if ($id <= 0 || !isset(submission_status_labels()[$status])) {
        return false;
    }
    db_update('user_submissions', ['status' => $status, 'updated_at' => date('Y-m-d H:i:s')], 'id = :id', ['id' => $id]);
    return true;
}

/** Cambia el peso manual (importancia) de una aportación. */
function submission_set_score(int $id, int $score): bool
{
    if ($id <= 0) {
        return false;
    }
    db_update('user_submissions', ['score' => max(0, min(5, $score)), 'updated_at' => date('Y-m-d H:i:s')], 'id = :id', ['id' => $id]);
    return true;
}

/** Testimonios aprobados, listos para publicar en la web. */
function testimonials_published(int $limit = 12): array
{
    $limit = max(1, min(50, $limit));
    return db_all(
        "SELECT s.id, s.title, s.body, s.created_at, u.avatar_url
           FROM user_submissions s LEFT JOIN users u ON u.id = s.user_id
          WHERE s.stype = 'testimonio' AND s.status = 'aprobada'
          ORDER BY s.created_at DESC LIMIT $limit"
    );
}

/**
 * Valida una aportación enviada desde la web.
 * Devuelve ['data' => [...], 'errors' => [campo => mensaje]].
 */
function validate_submission(array $data): array
{
    $errors = [];

    $type  = clean_text((string) ($data['tipo'] ?? 'testimonio'));
    $title = clean_text((string) ($data['titulo'] ?? ''));
    $body  = clean_text((string) ($data['texto'] ?? ($data['comentario'] ?? '')));

    if (!isset(submission_types()[$type])) {
        $errors['tipo'] = 'Elige el tipo de aportación.';
    }

    if ($type === 'testimonio') {
        // En un testimonio, el título es el nombre de quien lo firma.
        if (mb_strlen($title) < 2 || mb_strlen($title) > 120) {
            $errors['titulo'] = 'Escribe tu nombre (entre 2 y 120 caracteres).';
        }
        if (mb_strlen($body) < 10 || mb_strlen($body) > 1500) {
            $errors['texto'] = 'Cuéntanos tu experiencia (entre 10 y 1500 caracteres).';
        }
    } else {
        // En una pregunta, el título es la pregunta y el cuerpo la respuesta
        // o el detalle de la duda.
        if (mb_strlen($title) < 8 || mb_strlen($title) > 200) {
            $errors['titulo'] = 'Escribe la pregunta (entre 8 y 200 caracteres).';
        }
        if (mb_strlen($body) > 1500) {
            $errors['texto'] = 'El detalle no puede superar los 1500 caracteres.';
        }
    }

    return [
        'errors' => $errors,
        'data'   => [
            'stype' => $type,
            'title' => $title,
            'body'  => $body,
        ],
    ];
}
