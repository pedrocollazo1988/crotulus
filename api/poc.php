<?php
declare(strict_types=1);

/**
 * PROTOTIPO TEMPORAL (validar la opción C).
 * Sirve para comprobar dos cosas en Vercel:
 *   1) que el runtime vercel-php ejecuta PHP de verdad;
 *   2) que una URL "limpia" (sin .php), enrutada con un rewrite, NO la bloquea
 *      el firewall del sistema.
 * Si la prueba sale bien, se generaliza a un front-controller. Si no, se borra.
 * Cuando ya no haga falta, eliminar este archivo.
 */

header('Content-Type: text/plain; charset=utf-8');
echo "PHP OK\n";
echo 'version=' . PHP_VERSION . "\n";
echo 'uri=' . ($_SERVER['REQUEST_URI'] ?? '') . "\n";
echo 'metodo=' . ($_SERVER['REQUEST_METHOD'] ?? '') . "\n";
echo 'hora=' . date('c') . "\n";
