<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  CAPA DE BASE DE DATOS (PDO)
 *  Soporta PostgreSQL (Neon y similares), MySQL/MariaDB y SQLite (local).
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
    $driver = db_driver();

    try {
        if ($driver === 'pgsql') {
            // Neon y casi todo Postgres gestionado exigen conexion cifrada;
            // el sslmode se indica en el propio DSN.
            $dsn = sprintf(
                'pgsql:host=%s;port=%d;dbname=%s;sslmode=%s',
                $cfg['host'],
                (int) ($cfg['port'] ?: 5432),
                $cfg['name'],
                $cfg['sslmode'] ?? 'require'
            );
            $pdo = new PDO($dsn, $cfg['user'], $cfg['password'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } elseif ($driver === 'mysql') {
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

/** Motor actual: "pgsql", "mysql" o "sqlite". */
function db_driver(): string
{
    $d = (string) config('db.driver', 'sqlite');
    return in_array($d, ['pgsql', 'mysql', 'sqlite'], true) ? $d : 'sqlite';
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

/**
 * Añade una columna si no existe (migración sin pérdida de datos).
 * Se usa para actualizar instalaciones creadas antes de añadir el campo.
 */
function db_add_column(string $table, string $column, string $definition): void
{
    try {
        $pdo = db();
        if (db_driver() === 'pgsql') {
            $exists = db_one(
                'SELECT COUNT(*) AS c FROM information_schema.columns
                  WHERE table_schema = current_schema() AND table_name = ? AND column_name = ?',
                [$table, $column]
            );
        } elseif (db_driver() === 'mysql') {
            $exists = db_one(
                'SELECT COUNT(*) AS c FROM information_schema.columns
                  WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
                [$table, $column]
            );
        } else {
            $cols = db_all('PRAGMA table_info(' . $table . ')');
            $exists = null;
            foreach ($cols as $c) {
                if (($c['name'] ?? '') === $column) {
                    $exists = ['c' => 1];
                    break;
                }
            }
        }
        if (!$exists || (int) $exists['c'] === 0) {
            $pdo->exec("ALTER TABLE $table ADD COLUMN $column $definition");
        }
    } catch (Throwable $e) {
        app_log("db_add_column $table.$column: " . $e->getMessage());
    }
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
    // PostgreSQL: recuperamos el id con RETURNING (lastInsertId no es fiable
    // en tablas sin secuencia, como "settings", donde además falla).
    if (db_driver() === 'pgsql') {
        if ($table === 'settings') {
            db_query($sql, $data);
            return 0;
        }
        $row = db_one($sql . ' RETURNING id', $data);
        return (int) ($row['id'] ?? 0);
    }
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
    $driver = db_driver();
    $pg     = $driver === 'pgsql';
    $mysql  = $driver === 'mysql';
    $serial = $pg
        ? 'SERIAL PRIMARY KEY'
        : ($mysql ? 'INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT');
    $str    = $mysql ? 'VARCHAR(255)' : 'TEXT';
    $text   = 'TEXT';
    $ltext  = $mysql ? 'MEDIUMTEXT' : 'TEXT';  // para datos de sesion (mas grandes)
    $dt     = $pg ? 'TIMESTAMP' : 'DATETIME';
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

        // Datos de la sesion nativa de PHP (equivalente a un archivo de sesion).
        // Permite que el login funcione en serverless (Vercel), donde el disco
        // es efimero y no se pueden guardar sesiones en archivos.
        'php_sessions' => "CREATE TABLE IF NOT EXISTS php_sessions (
            id $str NOT NULL PRIMARY KEY,
            data $ltext NOT NULL,
            expires_at INT NOT NULL
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
            user_id INT NOT NULL DEFAULT 0,
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
            -- Peso manual de importancia (0-5) usado por las FAQ.
            score INT NOT NULL DEFAULT 0,
            is_active INT NOT NULL DEFAULT 1,
            created_at $dt DEFAULT NULL,
            updated_at $dt DEFAULT NULL
        ) $engine",

        // Aportaciones de los usuarios registrados (testimonios y preguntas).
        'user_submissions' => "CREATE TABLE IF NOT EXISTS user_submissions (
            id $serial,
            user_id INT NOT NULL,
            stype VARCHAR(20) NOT NULL,
            title $str DEFAULT '',
            body $text DEFAULT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pendiente',
            score INT NOT NULL DEFAULT 0,
            ip VARCHAR(45) DEFAULT '',
            created_at $dt DEFAULT NULL,
            updated_at $dt DEFAULT NULL
        ) $engine",

        'reviews' => "CREATE TABLE IF NOT EXISTS reviews (
            id $serial,
            target_type VARCHAR(20) NOT NULL,
            target_id INT NOT NULL DEFAULT 0,
            target_label $str DEFAULT '',
            rating INT NOT NULL DEFAULT 5,
            author_name $str NOT NULL,
            author_email $str DEFAULT '',
            comment $text DEFAULT NULL,
            -- Usuario registrado que envía la valoración (0 = anónimo antiguo).
            user_id INT NOT NULL DEFAULT 0,
            status VARCHAR(20) NOT NULL DEFAULT 'pendiente',
            ip VARCHAR(45) DEFAULT '',
            user_agent $str DEFAULT '',
            created_at $dt DEFAULT NULL
        ) $engine",

        // Articulos del blog. `meta` guarda datos extra en JSON (autor,
        // categoria, imagen de portada, extracto...). `is_active` = publicado.
        'blog_posts' => "CREATE TABLE IF NOT EXISTS blog_posts (
            id $serial,
            slug VARCHAR(200) NOT NULL DEFAULT '',
            title $str DEFAULT '',
            excerpt $text DEFAULT NULL,
            body $text DEFAULT NULL,
            category VARCHAR(80) DEFAULT '',
            author $str DEFAULT '',
            image $str DEFAULT '',
            meta $text DEFAULT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            is_active INT NOT NULL DEFAULT 1,
            published_at $dt DEFAULT NULL,
            created_at $dt DEFAULT NULL,
            updated_at $dt DEFAULT NULL
        ) $engine",

        // Miembros del equipo. `meta` guarda datos extra en JSON (cargo,
        // correo, telefono, redes, avatar...). `is_active` = visible en la web.
        'team_members' => "CREATE TABLE IF NOT EXISTS team_members (
            id $serial,
            name $str DEFAULT '',
            role $str DEFAULT '',
            bio $text DEFAULT NULL,
            email $str DEFAULT '',
            phone VARCHAR(40) DEFAULT '',
            avatar $str DEFAULT '',
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

    // Migración ligera: añade columnas nuevas a tablas ya existentes.
    db_add_column('content_items', 'score', 'INT NOT NULL DEFAULT 0');
    db_add_column('reviews', 'user_id', 'INT NOT NULL DEFAULT 0');
    db_add_column('contact_messages', 'user_id', 'INT NOT NULL DEFAULT 0');

    // Indices (se ignoran si ya existen)
    $indexes = [
        'CREATE UNIQUE INDEX idx_users_email ON users (email)',
        'CREATE UNIQUE INDEX idx_users_google ON users (google_id)',
        'CREATE INDEX idx_sessions_token ON sessions (token_hash)',
        'CREATE INDEX idx_sessions_user ON sessions (user_id)',
        'CREATE INDEX idx_php_sessions_expires ON php_sessions (expires_at)',
        'CREATE INDEX idx_tokens_hash ON tokens (token_hash)',
        'CREATE UNIQUE INDEX idx_rate_unique ON rate_limits (bucket, ip)',
        'CREATE INDEX idx_content_type ON content_items (ctype)',
        'CREATE INDEX idx_contact_created ON contact_messages (created_at)',
        'CREATE INDEX idx_reviews_status ON reviews (status)',
        'CREATE INDEX idx_reviews_target ON reviews (target_type, target_id)',
        'CREATE INDEX idx_submissions_type ON user_submissions (stype, status)',
        'CREATE INDEX idx_blog_active ON blog_posts (is_active, published_at)',
        'CREATE INDEX idx_team_active ON team_members (is_active, sort_order)',
    ];
    foreach ($indexes as $sql) {
        try {
            $pdo->exec($sql);
        } catch (Throwable $e) {
            // Indice ya existente (o no soportado por el motor): continuamos.
        }
    }

    seed_defaults();
    seed_content();
    seed_blog_and_team();
}

/** Devuelve true si una tabla existe (consulta portable MySQL/SQLite). */
function db_table_exists(string $table): bool
{
    try {
        if (db_driver() === 'pgsql') {
            $row = db_one(
                'SELECT COUNT(*) AS c FROM information_schema.tables
                  WHERE table_schema = current_schema() AND table_name = ?',
                [$table]
            );
        } elseif (db_driver() === 'mysql') {
            $row = db_one(
                'SELECT COUNT(*) AS c FROM information_schema.tables
                  WHERE table_schema = DATABASE() AND table_name = ?',
                [$table]
            );
        } else {
            $row = db_one(
                "SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'table' AND name = ?",
                [$table]
            );
        }
        return (int) ($row['c'] ?? 0) > 0;
    } catch (Throwable $e) {
        return false;
    }
}

/**
 * Siembra ejemplos del blog y del equipo la primera vez. Solo actua si la
 * tabla esta vacia, asi que nunca pisa lo que el administrador haya creado.
 * Es seguro aunque el esquema antiguo no tuviera estas tablas: se comprueba
 * su existencia antes de insertar.
 */
function seed_blog_and_team(): void
{
    $now = date('Y-m-d H:i:s');

    if (db_table_exists('team_members') && (int) (db_one('SELECT COUNT(*) AS c FROM team_members')['c'] ?? 0) === 0) {
        $team = [
            ['Marta López', 'Directora de proyectos', 'Coordina cada proyecto de principio a fin y se asegura de que cumplimos plazos y presupuesto.', 'marta.lopez@crotulus.example', 'assets/img/equipo/marta-lopez.svg'],
            ['Javier Ruiz', 'Ingeniero de redes', 'Diseña y protege la infraestructura de red de nuestros clientes, con foco en la seguridad.', 'javier.ruiz@crotulus.example', 'assets/img/equipo/javier-ruiz.svg'],
            ['Cristina Serra', 'Especialista en IA', 'Crea automatizaciones y agentes de IA que ahorran horas de trabajo repetitivo.', 'cristina.serra@crotulus.example', 'assets/img/equipo/cristina-serra.svg'],
            ['Diego Marín', 'Desarrollador web', 'Construye webs y aplicaciones rápidas, accesibles y fáciles de gestionar.', 'diego.marin@crotulus.example', 'assets/img/equipo/diego-marin.svg'],
        ];
        foreach ($team as $i => $m) {
            db_insert('team_members', [
                'name'       => $m[0],
                'role'       => $m[1],
                'bio'        => $m[2],
                'email'      => $m[3],
                'phone'      => '',
                'avatar'     => $m[4],
                'meta'       => null,
                'sort_order' => $i,
                'is_active'  => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    if (db_table_exists('blog_posts') && (int) (db_one('SELECT COUNT(*) AS c FROM blog_posts')['c'] ?? 0) === 0) {
        $posts = [
            [
                'automatizacion-ia-pymes',
                'Cómo la IA puede ahorrar horas a tu pyme',
                'Descubre qué tareas conviene automatizar primero y cómo empezar sin complicaciones.',
                'La inteligencia artificial ya no es cosa de grandes empresas. En este artículo repasamos tareas cotidianas que puedes automatizar —presupuestos, respuestas frecuentes, informes— y cómo dar el primer paso con un coste bajo.',
                'Automatización',
                'Marta López',
                'assets/img/blog/automatizacion-ia-pymes.svg',
            ],
            [
                'seguridad-red-pyme',
                'Protege tu red: 5 medidas básicas',
                'Cinco acciones sencillas que reducen drásticamente el riesgo de un incidente.',
                'No necesitas un gran presupuesto para proteger tu negocio. Estas cinco medidas —copias de seguridad, contraseñas robustas, actualizaciones, Wi-Fi segmentado y formación del equipo— cubren la mayoría de riesgos habituales.',
                'Seguridad',
                'Javier Ruiz',
                'assets/img/blog/seguridad-red-pyme.svg',
            ],
            [
                'web-que-convierte',
                'Una web que convierte visitas en clientes',
                'Qué debe tener tu web para que quien llega termine contactando contigo.',
                'Una web bonita que no genera contactos es un gasto, no una inversión. Repasamos los elementos que marcan la diferencia: mensaje claro, prueba social, llamadas a la acción visibles y velocidad de carga.',
                'Desarrollo web',
                'Diego Marín',
                'assets/img/blog/web-que-convierte.svg',
            ],
        ];
        foreach ($posts as $i => $p) {
            db_insert('blog_posts', [
                'slug'         => $p[0],
                'title'        => $p[1],
                'excerpt'      => $p[2],
                'body'         => $p[3],
                'category'     => $p[4],
                'author'       => $p[5],
                'image'        => $p[6],
                'meta'         => json_encode(['reading_minutes' => 4], JSON_UNESCAPED_UNICODE),
                'sort_order'   => $i,
                'is_active'    => 1,
                'published_at' => date('Y-m-d H:i:s', strtotime('-' . ($i + 1) . ' days')),
                'created_at'   => $now,
                'updated_at'   => $now,
            ]);
        }
    }
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

/**
 * Siembra el contenido editable la primera vez (servicios, proyectos,
 * testimonios, proceso y FAQ). Solo actua si content_items esta vacia, asi
 * que nunca pisa lo que el administrador haya creado o editado. A partir de
 * ahi la web se alimenta de la base de datos y el panel lo gestiona.
 */
function seed_content(): void
{
    if ((int) (db_one('SELECT COUNT(*) AS c FROM content_items')['c'] ?? 0) > 0) {
        return;
    }

    $demo = [
        'servicio' => [
            ['Desarrollo web y aplicaciones', 'Diseño y programación', 'Webs corporativas, tiendas online y aplicaciones a medida rápidas y fáciles de gestionar.'],
            ['Automatización y agentes de IA', 'Productividad', 'Automatizamos tareas repetitivas y creamos asistentes que atienden, filtran y organizan información.'],
            ['Soporte técnico', 'Atención continua', 'Atención rápida para tu equipo: incidencias, equipos y software resueltos sin perder tiempo.'],
            ['Redes y ciberseguridad', 'Infraestructura', 'Infraestructura de red estable y protegida, con copias de seguridad y planes de contingencia.'],
            ['Consultoría tecnológica', 'Estrategia', 'Analizamos qué necesitas de verdad y trazamos un plan realista, con presupuesto claro.'],
            ['Mantenimiento integral', 'Continuidad', 'Nos ocupamos de que todo siga funcionando: actualizaciones, monitorización y mejoras continuas.'],
        ],
        'proyecto' => [
            ['Tienda online para distribuidora local', 'Desarrollo web', 'Catálogo de más de 2.000 referencias, pago integrado y panel de gestión para el equipo.', ['image' => 'assets/img/proyecto-web.svg']],
            ['Asistente que atiende consultas 24/7', 'Automatización e IA', 'Un agente de IA que responde dudas frecuentes y deriva las incidencias al equipo humano.', ['image' => 'assets/img/proyecto-ia.svg']],
            ['Renovación de red en oficinas', 'Redes y seguridad', 'Cableado, Wi-Fi profesional y firewall gestionado para 60 puestos de trabajo.', ['image' => 'assets/img/proyecto-redes.svg']],
        ],
        'testimonio' => [
            // [nombre, cargo, texto, ['photo' => ruta, 'rating' => 1-5, 'resultado' => dato]]
            ['Marta López', 'Gerente · Distribuciones ML', 'Nos renovaron la web y automatizaron los presupuestos. Ahora ahorramos varias horas cada semana y todo es mucho más claro.', ['photo' => 'assets/img/testimonios/marta-lopez.jpg', 'rating' => 5, 'resultado' => '+40% de solicitudes online en 3 meses']],
            ['Javier Ruiz', 'Director · Talleres Ruiz', 'En una semana teníamos la red y las copias de seguridad funcionando. El soporte responde siempre rápido.', ['photo' => 'assets/img/testimonios/javier-ruiz.jpg', 'rating' => 5, 'resultado' => '0 incidencias críticas en 12 meses']],
            ['Cristina Serra', 'Fundadora · CliniSalud', 'Un asistente de IA atiende nuestras consultas fuera de horario. Ha mejorado la atención al cliente notablemente.', ['photo' => 'assets/img/testimonios/cristina-serra.jpg', 'rating' => 5, 'resultado' => '70% de consultas resueltas sin espera']],
        ],
        'proceso' => [
            ['Diagnóstico', '', 'Escuchamos tus necesidades y analizamos el estado actual de tu tecnología.'],
            ['Propuesta', '', 'Recibes una solución clara, con alcance, plazos y precio cerrado.'],
            ['Implementación', '', 'Ejecutamos el proyecto con seguimiento y pruebas antes de la entrega.'],
            ['Soporte', '', 'Te acompañamos después: mantenimiento, mejoras y atención cuando lo necesites.'],
        ],
        'faq' => [
            // [pregunta, '', respuesta, score(0-5) de importancia para la portada]
            ['¿Cuánto cuesta un proyecto?', '', 'Depende del alcance. Tras el diagnóstico gratuito te entregamos un presupuesto cerrado y sin compromiso, con todo detallado.', 5],
            ['¿Cuánto tardáis en entregar?', '', 'Una web corporativa suele estar en 2-4 semanas. Los proyectos de automatización o redes dependen del alcance; acordamos plazos antes de empezar.', 4],
            ['¿Ofrecéis garantía?', '', 'Sí. Todo trabajo incluye garantía sobre lo entregado y, opcionalmente, un plan de mantenimiento para mantenerlo actualizado y seguro.', 3],
            ['¿Qué incluye el soporte?', '', 'Atención por teléfono, correo o WhatsApp, resolución de incidencias, actualizaciones de seguridad y asesoramiento según el plan contratado.', 2],
            ['¿Cómo puedo pagar?', '', 'Aceptamos transferencia bancaria y pago con tarjeta. En proyectos grandes, un anticipo al empezar y el resto a la entrega.', 2],
            ['¿Cómo empiezo?', '', 'Escríbenos por el formulario o WhatsApp. Concertamos una llamada o reunión sin coste y te proponemos los siguientes pasos.', 3],
        ],
    ];

    $now = date('Y-m-d H:i:s');
    foreach ($demo as $ctype => $items) {
        foreach ($items as $i => $it) {
            db_insert('content_items', [
                'ctype'      => $ctype,
                'title'      => $it[0],
                'subtitle'   => $it[1],
                'body'       => $it[2],
                'meta'       => isset($it[3]) && is_array($it[3]) ? json_encode($it[3], JSON_UNESCAPED_UNICODE) : null,
                // En las FAQ, el 4º valor es el peso de importancia (0-5).
                'score'      => ($ctype === 'faq' && isset($it[3]) && is_int($it[3])) ? $it[3] : 0,
                'sort_order' => $i,
                'is_active'  => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
}
