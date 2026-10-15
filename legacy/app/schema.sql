-- ============================================================================
--  C-ROTULUS · Esquema de la base de datos (MySQL / MariaDB)
-- ----------------------------------------------------------------------------
--  Normalmente NO necesitas ejecutar esto: el backend crea las tablas solo
--  la primera vez que se abre. Úsalo si prefieres crearlas a mano desde
--  phpMyAdmin o si tu proveedor no permite crear tablas en tiempo de ejecución.
--
--  Uso en phpMyAdmin: selecciona tu base de datos > pestaña SQL > pega y ejecuta.
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) DEFAULT '',
  password_hash VARCHAR(255) DEFAULT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  email_verified_at DATETIME DEFAULT NULL,
  google_id VARCHAR(255) DEFAULT NULL,
  avatar_url VARCHAR(255) DEFAULT NULL,
  last_login_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  ip VARCHAR(45) DEFAULT '',
  user_agent VARCHAR(255) DEFAULT '',
  created_at DATETIME DEFAULT NULL,
  expires_at DATETIME DEFAULT NULL,
  revoked_at DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tokens (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(30) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME DEFAULT NULL,
  used_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_messages (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(40) DEFAULT '',
  service VARCHAR(255) DEFAULT '',
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'nuevo',
  ip VARCHAR(45) DEFAULT '',
  user_agent VARCHAR(255) DEFAULT '',
  created_at DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rate_limits (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  bucket VARCHAR(255) NOT NULL,
  ip VARCHAR(45) NOT NULL,
  hits INT NOT NULL DEFAULT 1,
  window_start INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  skey VARCHAR(255) NOT NULL PRIMARY KEY,
  svalue TEXT DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS content_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ctype VARCHAR(30) NOT NULL,
  title VARCHAR(255) DEFAULT '',
  subtitle VARCHAR(255) DEFAULT '',
  body TEXT DEFAULT NULL,
  meta TEXT DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  score INT NOT NULL DEFAULT 0,
  is_active INT NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_submissions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  stype VARCHAR(20) NOT NULL,
  title VARCHAR(255) DEFAULT '',
  body TEXT DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  score INT NOT NULL DEFAULT 0,
  ip VARCHAR(45) DEFAULT '',
  created_at DATETIME DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  target_type VARCHAR(20) NOT NULL,
  target_id INT NOT NULL DEFAULT 0,
  target_label VARCHAR(255) DEFAULT '',
  rating INT NOT NULL DEFAULT 5,
  author_name VARCHAR(255) NOT NULL,
  author_email VARCHAR(255) DEFAULT '',
  comment TEXT DEFAULT NULL,
  user_id INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  ip VARCHAR(45) DEFAULT '',
  user_agent VARCHAR(255) DEFAULT '',
  created_at DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
--  Blog: articulos publicados en la web (gestionados desde admin/blog.php)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blog_posts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(200) NOT NULL DEFAULT '',
  title VARCHAR(255) DEFAULT '',
  excerpt TEXT DEFAULT NULL,
  body TEXT DEFAULT NULL,
  category VARCHAR(80) DEFAULT '',
  author VARCHAR(255) DEFAULT '',
  image VARCHAR(255) DEFAULT '',
  meta TEXT DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active INT NOT NULL DEFAULT 1,
  published_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
--  Equipo: personas mostradas en la seccion "Equipo" (admin/team.php)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_members (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) DEFAULT '',
  role VARCHAR(255) DEFAULT '',
  bio TEXT DEFAULT NULL,
  email VARCHAR(255) DEFAULT '',
  phone VARCHAR(40) DEFAULT '',
  avatar VARCHAR(255) DEFAULT '',
  meta TEXT DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active INT NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE UNIQUE INDEX idx_users_email  ON users (email);
CREATE UNIQUE INDEX idx_users_google ON users (google_id);
CREATE INDEX idx_sessions_token      ON sessions (token_hash);
CREATE INDEX idx_sessions_user       ON sessions (user_id);
CREATE INDEX idx_tokens_hash         ON tokens (token_hash);
CREATE UNIQUE INDEX idx_rate_unique  ON rate_limits (bucket, ip);
CREATE INDEX idx_content_type        ON content_items (ctype);
CREATE INDEX idx_contact_created     ON contact_messages (created_at);
CREATE INDEX idx_reviews_status      ON reviews (status);
CREATE INDEX idx_reviews_target      ON reviews (target_type, target_id);
CREATE INDEX idx_submissions_type    ON user_submissions (stype, status);
CREATE INDEX idx_blog_active         ON blog_posts (is_active, published_at);
CREATE INDEX idx_team_active         ON team_members (is_active, sort_order);
