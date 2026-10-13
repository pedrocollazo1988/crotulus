<?php
declare(strict_types=1);

/**
 *  CERRAR SESION  ->  /admin/logout.php
 */
require_once __DIR__ . '/../app/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && csrf_verify($_POST['_csrf'] ?? null)) {
    auth_logout();
}
header('Location: ' . url('admin/login.php'));
exit;
