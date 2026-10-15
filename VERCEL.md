# Caso de uso · Despliegue en Vercel (C-ROTULUS)

Esta guía explica cómo publicar C-ROTULUS **completo** (web estática + panel PHP
+ API) en **Vercel**, usando la **opción B (contenedor)**.

> **Conclusión corta:** sí se puede tener *todo* en Vercel, con dos condiciones:
> 1) empaquetar el backend en **un contenedor** (FrankenPHP/Caddy) en vez de 21
>    funciones serverless, y 2) usar **URLs sin `.php`**, porque el firewall de
>    Vercel bloquea cualquier petición terminada en `.php`. La base de datos es
>    **externa** (MySQL/Postgres); el contenedor no guarda archivos.

---

## 0. El error `403 Forbidden` al pulsar «Acceder» (diagnóstico)

Si ves `Forbidden` con un identificador tipo `sfo1::…` / `cle1::…`, **no lo genera
tu PHP**: lo genera el **firewall (WAF) de Vercel**. La cabecera de respuesta lo
confirma:

    x-vercel-mitigated: deny     (<- bloqueo duro)

Comprobado con peticiones reales: Vercel bloquea **cualquier URL terminada en
`.php`** (`/index.php`, `/api/index.php`, `/admin/login.php`, `/wp-admin`…),
mientras que las rutas sin `.php` **no** se bloquean. Por eso la aplicación usa
**URLs limpias** (ver sección 4).

---

## 1. Por qué un contenedor (y no funciones sueltas)

El **plan Hobby limita a 12 funciones serverless por despliegue**. Este proyecto
tiene **21 archivos `.php`** (`admin/` + `api/`), así que un despliegue por
funciones **falla con**:

    Error: No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan.

La solución: un único **servicio de tipo contenedor** (`Dockerfile.vercel`) con
un servidor web real (**FrankenPHP + Caddy**) que ejecuta PHP. Es **una sola
función**, así que respeta el límite. El *Container Runtime* de Vercel está en
**beta y disponible en todos los planes**, incluido Hobby.

---

## 2. Archivos de la opción B (ya en el repo)

| Archivo | Para qué sirve |
|---|---|
| `Dockerfile.vercel` | Construye la imagen (PHP 8.4 + extensiones) y arranca FrankenPHP. |
| `Caddyfile` | Servidor web: raíz `/app`, `try_files` con URLs limpias. |
| `vercel.json` | Declara el `service` contenedor y enruta todo el tráfico a él. |
| `.dockerignore` | No copia `.git`, datos locales ni docs a la imagen. |
| `.vercelignore` | Qué NO se sube a Vercel (credenciales, herramientas, docs). |

---

## 3. Base de datos (obligatoria y externa)

El contenedor de Vercel **no conserva archivos** (se apaga al no haber tráfico).
Por tanto la base de datos **debe ser externa**:

- **MySQL/Postgres gestionado** (Raiola, PlanetScale, Neon, supabase, Railway…).
- Configura las credenciales con **variables de entorno** en Vercel
  (Project -> Settings -> Environment Variables). `app/config.php` ya las lee:

| Variable | Ejemplo | Notas |
|---|---|---|
| `DB_DRIVER` | `mysql` | `mysql` o `sqlite` |
| `DB_HOST` | `tu-host.mysql.db` | Host de la BD |
| `DB_PORT` | `3306` | |
| `DB_NAME` | `crotulus` | |
| `DB_USER` | `usuario` | |
| `DB_PASSWORD` | (secreto) | |
| `APP_SITE_URL` | `https://www.c-rotulus.com` | Sin barra final |
| `APP_KEY` | (clave larga) | Firma de sesiones/CSRF |
| `MAIL_SMTP_USER`, `MAIL_SMTP_PASS`, `MAIL_TO` | … | Correo |

> Sin `DB_*` la web carga (contenido por defecto) pero el panel y el formulario
> devuelven error de conexión.

---

## 4. URLs limpias (imprescindible en Vercel)

La app **enlaza siempre a URLs sin `.php`**:

| URL pública | Archivo real |
|---|---|
| `/admin/login` | `admin/login.php` |
| `/api/contact` | `api/contact.php` |
| `/empresa` | `empresa.html` |

Esto lo resuelve:
- **En Vercel:** el `Caddyfile` (`try_files {path} {path}.php {path}.html …`).
- **En un hosting Apache (Raiola):** las reglas de reescritura del `.htaccess`.

En PHP se centraliza en `url()` (`app/lib/helpers.php`) y en el front, en
`withBackend()` (`js/main.js`). **No hay que cambiar nada más.**

---

## 5. Primer despliegue en Vercel

1. Importa el repositorio en Vercel (producción = rama `main`).
2. **Settings -> Environment Variables**: añade las `DB_*` y `APP_SITE_URL`.
3. **Settings -> Functions** (si aplica): deja el *Container Runtime* activado.
4. Despliega. En **Deployments** verás el build y, al terminar, la URL.
5. Comprueba:
   - `/` y `/empresa` cargan.
   - `/admin/login` responde `200` (no `403`).
   - El formulario de contacto guarda el mensaje.

> **Vista previa (preproducción):** en **Deployments**, el despliegue marcado
> *Preview* tiene botón **Visit**. Por defecto, las previews están **protegidas**
> (pide iniciar sesión en Vercel). Para verlas sin login: **Settings ->
> Deployment Protection** -> ajusta *Vercel Authentication* (solo Preview).

---

## 6. Alternativa clásica: Raiola (sin contenedor)

Si prefieres **no depender del beta de contenedores**, la vía más sencilla sigue
siendo publicar en un **hosting con PHP** (Raiola): ahí no hay límite de 12
funciones ni firewall anti-`.php`. El backend es el mismo y las **URLs limpias
del `.htaccess`** ya están preparadas. Guía paso a paso en **`DEPLOY-RAIOLA.md`**.

En ese caso, en Vercel se puede publicar solo la web estática (rama `main`) y
apuntar el panel al hosting con PHP con `BACKEND_URL` en `js/main.js`
(`var BACKEND_URL = "https://www.c-rotulus.com";`).

---

## 7. Probar el contenedor en local (opcional)

Requiere Docker instalado:

    docker build -f Dockerfile.vercel -t crotulus .
    docker run --rm -p 8080:80 -e DB_DRIVER=sqlite -e APP_SITE_URL=http://localhost:8080 crotulus
    # abre http://localhost:8080

(SQLite sirve solo para pruebas locales; en producción usa MySQL/Postgres.)
