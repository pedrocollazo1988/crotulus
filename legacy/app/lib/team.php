<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  EQUIPO · Lectura publica de los miembros
 *  La web consume estos datos via /api/index.php?resource=team
 *  El panel los gestiona en /admin/team.php
 * ============================================================================
 */

/**
 * Devuelve los miembros del equipo (o todos si $onlyActive = false).
 *
 * @return array<int,array<string,mixed>>
 */
function team_members(bool $onlyActive = true): array
{
    if (!db_table_exists('team_members')) {
        return [];
    }

    $sql = 'SELECT * FROM team_members';
    if ($onlyActive) {
        $sql .= ' WHERE is_active = 1';
    }
    $sql .= ' ORDER BY sort_order ASC, id ASC';

    $rows = db_all($sql);
    foreach ($rows as &$row) {
        $row['meta'] = $row['meta'] ? json_decode((string) $row['meta'], true) : null;
    }
    unset($row);

    return $rows;
}

/** Devuelve un miembro por id (o null). */
function team_member_by_id(int $id): ?array
{
    if (!db_table_exists('team_members')) {
        return null;
    }
    $row = db_one('SELECT * FROM team_members WHERE id = ?', [$id]);
    if ($row) {
        $row['meta'] = $row['meta'] ? json_decode((string) $row['meta'], true) : null;
    }
    return $row;
}

/**
 * Convierte una fila de la base de datos en el formato publico que espera
 * el front-end (main.js).
 */
function team_member_public(array $row): array
{
    $meta = is_array($row['meta'] ?? null) ? $row['meta'] : [];
    return [
        'id'       => (int) $row['id'],
        'name'     => (string) ($row['name'] ?? ''),
        'role'     => (string) ($row['role'] ?? ''),
        'bio'      => (string) ($row['bio'] ?? ''),
        'email'    => (string) ($row['email'] ?? ''),
        'phone'    => (string) ($row['phone'] ?? ''),
        'avatar'   => (string) ($row['avatar'] ?? ''),
        'linkedin' => (string) ($meta['linkedin'] ?? ''),
    ];
}
