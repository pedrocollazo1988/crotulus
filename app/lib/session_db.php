<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  SESIONES EN BASE DE DATOS
 * ----------------------------------------------------------------------------
 *  PHP, por defecto, guarda las sesiones en archivos del disco del servidor.
 *  En un hosting serverless como Vercel el disco es efímero y de solo lectura,
 *  así que cada petición "perdería" la sesión y el login nunca funcionaría.
 *
 *  Solución: este manejador (session_set_save_handler) guarda y lee los datos
 *  de sesión en una tabla de la base de datos (php_sessions). Así la sesión
 *  sobrevive entre peticiones sin depender del disco.
 *
 *  Se activa con la opción de configuración:
 *      'security' => [ 'session_handler' => 'database' ]
 *  (ver app/config.php). En hosting clásico con PHP se puede dejar 'files'.
 * ========================================================================== */

/** Manoja las sesiones PHP guardando los datos en la tabla php_sessions. */
final class CroSessionHandler implements SessionHandlerInterface
{
    private const TTL = 2592000; // 30 días (se puede ajustar en config)

    private int $ttl;

    public function __construct(int $ttl = self::TTL)
    {
        $this->ttl = $ttl > 0 ? $ttl : self::TTL;
    }

    public function open(string $path, string $name): bool
    {
        // La conexión se abre de forma perezosa en cada operación (patrón db()).
        return true;
    }

    public function close(): bool
    {
        return true;
    }

    public function read(string $id): string|false
    {
        try {
            $row = db_one(
                'SELECT data FROM php_sessions WHERE id = ? AND expires_at > ?',
                [$id, time()]
            );
            return $row ? (string) $row['data'] : '';
        } catch (Throwable $e) {
            return '';
        }
    }

    public function write(string $id, string $data): bool
    {
        try {
            // Borra la fila previa y la reescribe: portable en MySQL y SQLite
            // y evita depender del "upsert" de cada motor.
            db_query('DELETE FROM php_sessions WHERE id = ?', [$id]);
            db_insert('php_sessions', [
                'id'         => $id,
                'data'       => $data,
                'expires_at' => time() + $this->ttl,
            ]);
            return true;
        } catch (Throwable $e) {
            app_log('Session write failed: ' . $e->getMessage());
            return false;
        }
    }

    public function destroy(string $id): bool
    {
        try {
            db_query('DELETE FROM php_sessions WHERE id = ?', [$id]);
            return true;
        } catch (Throwable $e) {
            return false;
        }
    }

    public function gc(int $max_lifetime): int|false
    {
        try {
            return db_query('DELETE FROM php_sessions WHERE expires_at < ?', [time()])->rowCount();
        } catch (Throwable $e) {
            return false;
        }
    }
}

/** Registra el manejador de sesiones en base de datos (una sola vez). */
function security_use_db_sessions(int $ttl = 2592000): void
{
    static $registered = false;
    if ($registered) {
        return;
    }
    $registered = true;

    // Sin esto PHP no llamaría a write()/gc() al final de la petición.
    session_set_save_handler(new CroSessionHandler($ttl), true);
}
