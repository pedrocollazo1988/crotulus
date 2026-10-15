<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  C-ROTULUS · COPIA DE SEGURIDAD DE LA BASE DE DATOS
 * ----------------------------------------------------------------------------
 *  Crea una copia con fecha en app/data/backups/. Funciona con MySQL y SQLite.
 *
 *  USO MANUAL:
 *      php deploy/cron/backup.php
 *
 *  AUTOMATICO (cron de cPanel/Plesk/VPS, una vez al dia a las 3:00):
 *      0 3 * * *  /usr/bin/php /ruta/completa/deploy/cron/backup.php >/dev/null 2>&1
 *
 *  Conserva las ultimas 14 copias (editable en $conservar). Borra las mas
 *  antiguas para no llenar el hosting.
 * ============================================================================
 */

require dirname(__DIR__, 2) . '/app/bootstrap.php';

$conservar = 14;                       // numero de copias a mantener
$dir = DATA_DIR . '/backups';
if (!is_dir($dir) && !@mkdir($dir, 0750, true)) {
    fwrite(STDERR, "No se pudo crear la carpeta de copias: {$dir}\n");
    exit(1);
}

$sello = date('Y-m-d_His');
$destino = '';
$driver = db_driver();

try {
    if ($driver === 'mysql') {
        /* --- MySQL/MariaDB: volcado en SQL puro con PDO ------------------- */
        $pdo = db();
        $destino = $dir . '/crotulus-' . $sello . '.sql';
        $fh = fopen($destino, 'wb');
        if (!$fh) {
            throw new RuntimeException('No se pudo abrir el archivo de copia.');
        }
        fwrite($fh, "-- Copia de C-ROTULUS ({$sello})\nSET NAMES utf8mb4;\n\n");

        $tablas = db_all('SHOW TABLES');
        foreach ($tablas as $fila) {
            $tabla = (string) array_values($fila)[0];
            $crear = db_one('SHOW CREATE TABLE `' . $tabla . '`');
            fwrite($fh, "DROP TABLE IF EXISTS `{$tabla}`;\n" . (string) array_values($crear)[1] . ";\n\n");

            $filas = db_all('SELECT * FROM `' . $tabla . '`');
            foreach ($filas as $f) {
                $cols = array_map(static fn($c) => '`' . $c . '`', array_keys($f));
                $vals = array_map(static function ($v) use ($pdo) {
                    return $v === null ? 'NULL' : $pdo->quote((string) $v);
                }, array_values($f));
                fwrite($fh, 'INSERT INTO `' . $tabla . '` (' . implode(',', $cols) . ') VALUES (' . implode(',', $vals) . ");\n");
            }
            fwrite($fh, "\n");
        }
        fclose($fh);
    } else {
        /* --- SQLite: copiamos el archivo con la API de backup ------------- */
        $sqlite = (string) config('db.sqlite_path', DATA_DIR . '/c-rotulus.sqlite');
        $destino = $dir . '/crotulus-' . $sello . '.sqlite';
        if (!is_file($sqlite)) {
            throw new RuntimeException("No existe la base de datos: {$sqlite}");
        }
        $origen = new PDO('sqlite:' . $sqlite);
        $origen->exec('VACUUM INTO ' . $origen->quote($destino));   // copia consistente
    }
} catch (Throwable $e) {
    fwrite(STDERR, 'Error en la copia: ' . $e->getMessage() . "\n");
    exit(1);
}

/* --- Rotacion: borra las copias mas antiguas ----------------------------- */
$copias = glob($dir . '/crotulus-*') ?: [];
sort($copias);                                          // mas antigua primero
$sobran = count($copias) - $conservar;
for ($i = 0; $i < $sobran; $i++) {
    @unlink($copias[$i]);
}

$tam = is_file($destino) ? round(filesize($destino) / 1024, 1) . ' KB' : '?';
echo 'Copia creada: ' . basename($destino) . " ({$tam}). Copias guardadas: " . min(count($copias), $conservar) . ".\n";
exit(0);
