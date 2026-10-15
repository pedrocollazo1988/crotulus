<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  BLOG · Lectura publica de los articulos
 *  La web consume estos datos via /api/index.php?resource=blog
 *  El panel los gestiona en /admin/blog.php
 * ============================================================================
 */

/**
 * Devuelve los articulos publicados (o todos si $onlyActive = false).
 * Ordenados por fecha de publicacion descendente y luego por orden manual.
 *
 * @param int  $limit      Numero maximo de articulos (0 = sin limite).
 * @param bool $onlyActive Solo articulos publicados (is_active = 1).
 * @param bool $withBody   Incluir el cuerpo completo del articulo.
 * @return array<int,array<string,mixed>>
 */
function blog_posts(int $limit = 0, bool $onlyActive = true, bool $withBody = false): array
{
    if (!db_table_exists('blog_posts')) {
        return [];
    }

    $cols = 'id, slug, title, excerpt, category, author, image, meta, sort_order,
             is_active, published_at, created_at';
    if ($withBody) {
        $cols .= ', body';
    }

    $sql = "SELECT $cols FROM blog_posts";
    if ($onlyActive) {
        $sql .= ' WHERE is_active = 1';
    }
    $sql .= ' ORDER BY published_at DESC, sort_order ASC, id DESC';
    if ($limit > 0) {
        $sql .= ' LIMIT ' . max(1, $limit);
    }

    $rows = db_all($sql);
    foreach ($rows as &$row) {
        $row['meta'] = $row['meta'] ? json_decode((string) $row['meta'], true) : null;
    }
    unset($row);

    return $rows;
}

/** Devuelve un articulo por id (o null). */
function blog_post_by_id(int $id): ?array
{
    if (!db_table_exists('blog_posts')) {
        return null;
    }
    $row = db_one('SELECT * FROM blog_posts WHERE id = ?', [$id]);
    if ($row) {
        $row['meta'] = $row['meta'] ? json_decode((string) $row['meta'], true) : null;
    }
    return $row;
}

/**
 * Convierte una fila de la base de datos en el formato publico que espera
 * el front-end (main.js). Se usa tanto en la API como en el panel.
 */
function blog_post_public(array $row): array
{
    $meta = is_array($row['meta'] ?? null) ? $row['meta'] : [];
    return [
        'id'              => (int) $row['id'],
        'slug'            => (string) ($row['slug'] ?? ''),
        'title'           => (string) ($row['title'] ?? ''),
        'excerpt'         => (string) ($row['excerpt'] ?? ''),
        'body'            => (string) ($row['body'] ?? ''),
        'category'        => (string) ($row['category'] ?? ''),
        'author'          => (string) ($row['author'] ?? ''),
        'image'           => (string) ($row['image'] ?? ''),
        'reading_minutes' => (int) ($meta['reading_minutes'] ?? 0),
        'published_at'    => (string) ($row['published_at'] ?? ''),
    ];
}
