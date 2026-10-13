<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  CAPA DE BASE DE DATOS (PDO)
 *  Soporta MySQL/MariaDB (recomendado en hosting) y SQLite (pruebas locales).
 *  Crea el esquema automaticamente la primera vez que se ejecuta.
 * ============================================================================
 */

/** Conexion PDO unica (patron singleton). */
function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $cfg    = config('db');
    $driver = $cfg['driver'] ?? 'sqlite';

    try {
        if ($driver === 'mysql') {
            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=%s',
                $cfg['host'],
                (int) $cfg['port'],
                $cfg['name'],
                $cfg['charset'] ?? 'utf8mb4'
            );
            $pdo = new PDO($dsn, $cfg['user'], $cfg['password'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } else {
            if (!is_dir(DATA_DIR)) {
                @mkdir(DATA_DIR, 0750, true);
            }
            $pdo = new PDO('sqlite:' . $cfg['sqlite_path'], null, null, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
            $pdo->exec('PRAGMA foreign_keys = ON');
            $pdo->exec('PRAGMA journal_mode = WAL');
        }
    } catch (Throwable $e) {
        app_log('DB connection failed: ' . $e->getMessage());
        json_error('No se pudo conectar con la base de datos.', 500);
    }

    return $pdo;
}

/** Motor actual ("mysql" o "sqlite"). */
function db_driver(): string
{
    return config('db.driver', 'sqlite') === 'mysql' ? 'mysql' : 'sqlite';
}

/** Ejecuta una consulta preparada y devuelve el statement. */
function db_query(string $sql, array $params = []): PDOStatement
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}

/** Devuelve una sola fila (o null). */
function db_one(string $sql, array $params = []): ?array
{
    $row = db_query($sql, $params)->fetch();
    return $row === false ? null : $row;
}

/** Devuelve todas las filas. */
function db_all(string $sql, array $params = []): array
{
    return db_query($sql, $params)->fetchAll();
}

/** Inserta una fila y devuelve el id generado. */
function db_insert(string $table, array $data): int
{
    $cols = array_keys($data);
    $sql  = sprintf(
        'INSERT INTO %s (%s) VALUES (%s)',
        $table,
        implode(', ', $cols),
        implode(', ', array_map(fn($c) => ':' . $c, $cols))
    );
    db_query($sql, $data);
    return (int) db()->lastInsertId();
}

/** Actualiza filas de forma segura (columnas controladas por el codigo). */
function db_update(string $table, array $data, string $where, array $whereParams = []): int
{
    $sets = implode(', ', array_map(fn($c) => "$c = :$c", array_keys($data)));
    $stmt = db_query("UPDATE $table SET $sets WHERE $where", array_merge($data, $whereParams));
    return $stmt->rowCount();
}

/* ==========================================================================
   ESQUEMA
   ========================================================================== */

function db_init(): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    $pdo    = db();
    $mysql  = db_driver() === 'mysql';
    $serial = $mysql ? 'INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    $str    = $mysql ? 'VARCHAR(255)' : 'TEXT';
    $text   = 'TEXT';
    $dt     = 'DATETIME';
    $engine = $mysql ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '';

    $tables = [

        'users' => "CREATE TABLE IF NOT EXISTS users (
            id $serial,
            email $str NOT NULL,
            name $str DEFAULT '',
            password_hash $str DEFAULT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'user',
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            email_verified_at $dt DEFAULT NULL,
            google_id $str DEFAULT NULL,
            avatar_url $str DEFAULT NULL,
            last_login_at $dt DEFAULT NULL,
            created_at $dt DEFAULT NULL,
            updated_at $dt DEFAULT NULL
        ) $engine",

        'sessions' => "CREATE TABLE IF NOT EXISTS sessions (
            id $serial,
            user_id INT NOT NULL,
            token_hash $str NOT NULL,
            ip VARCHAR(45) DEFAULT '',
            user_agent $str DEFAULT '',
            created_at $dt DEFAULT NULL,
            expires_at $dt DEFAULT NULL,
            revoked_at $dt DEFAULT NULL
        ) $engine",

        'tokens' => "CREATE TABLE IF NOT EXISTS tokens (
            id $serial,
            user_id INT NOT NULL,
            type VARCHAR(30) NOT NULL,
            token_hash $str NOT NULL,
            expires_at $dt DEFAULT NULL,
            used_at $dt DEFAULT NULL,
            created_at $dt DEFAULT NULL
        ) $engine",

        'contact_messages' => "CREATE TABLE IF NOT EXISTS contact_messages (
            id $serial,
            name $str NOT NULL,
            email $str NOT NULL,
            phone VARCHAR(40) DEFAULT '',
            service $str DEFAULT '',
            message $text NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'nuevo',
            ip VARCHAR(45) DEFAULT '',
            user_agent $str DEFAULT '',
            created_at $dt DEFAULT NULL
        ) $engine",

        'rate_limits' => "CREATE TABLE IF NOT EXISTS rate_limits (
            id $serial,
            bucket $str NOT NULL,
            ip VARCHAR(45) NOT NULL,
            hits INT NOT NULL DEFAULT 1,
            window_start INT NOT NULL
        ) $engine",

        'settings' => "CREATE TABLE IF NOT EXISTS settings (
            skey $str NOT NULL PRIMARY KEY,
            svalue $text DEFAULT NULL,
            updated_at $dt DEFAULT NULL
        ) $engine",

        'content_items' => "CREATE TABLE IF NOT EXISTS content_items (
            id $serial,
            ctype VARCHAR(30) NOT NULL,
            title $str DEFAULT '',
            subtitle $str DEFAULT '',
            body $text DEFAULT NULL,
            meta $text DEFAULT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            is_active INT NOT NULL DEFAULT 1,
            created_at $dt DEFAULT NULL,
            updated_at $dt DEFAULT NULL
        ) $engine",
    ];

    foreach ($tables as $sql) {
        $pdo->exec($sql);
    }

    // Indices (se ignoran si ya existen)
    $indexes = [
        'CREATE UNIQUE INDEX idx_users_email ON users (email)',
        'CREATE UNIQUE INDEX idx_users_google ON users (google_id)',
        'CREATE INDEX idx_sessions_token ON sessions (token_hash)',
        'CREATE INDEX idx_sessions_user ON sessions (user_id)',
        'CREATE INDEX idx_tokens_hash ON tokens (token_hash)',
        'CREATE UNIQUE INDEX idx_rate_unique ON rate_limits (bucket, ip)',
        'CREATE INDEX idx_content_type ON content_items (ctype)',
        'CREATE INDEX idx_contact_created ON contact_messages (created_at)',
    ];
    foreach ($indexes as $sql) {
        try {
            $pdo->exec($sql);
        } catch (Throwable $e) {
            // Indice ya existente: continuamos.
        }
    }

    seed_defaults();
}

/** Inserta los valores por defecto (solo si la tabla esta vacia). */
function seed_defaults(): void
{
    foreach ((config('defaults') ?? []) as $key => $value) {
        $exists = db_one('SELECT skey FROM settings WHERE skey = ?', [$key]);
        if (!$exists) {
            db_insert('settings', [
                'skey'       => $key,
                'svalue'     => (string) $value,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
        }
    }
}
