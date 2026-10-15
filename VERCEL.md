# Despliegue en Vercel · C-ROTULUS (Next.js + PostgreSQL)

Guia para publicar C-ROTULUS **completo** (web estatica + panel + API) en Vercel,
sin contenedores y sin plan Pro.

> **Resumen:** el backend esta reescrito en **Next.js 15 + Prisma + PostgreSQL**,
> que Vercel ejecuta de forma nativa. La base de datos vive en **Neon** (Postgres
> externo). El backend PHP antiguo queda en `legacy/` como referencia y **no se
> despliega**.

---

## 0. Por que NO se usa el backend PHP en Vercel

Dos motivos, comprobados con peticiones reales:

1. **El firewall (WAF) de Vercel bloquea cualquier URL terminada en `.php`.**
   La respuesta trae `x-vercel-mitigated: deny` / `challenge` y `server: Vercel`.
   Afecta a `/index.php`, `/api/index.php`, `/admin/login.php`, `/wp-admin`...
2. **El plan Hobby limita a 12 funciones serverless por despliegue.** El backend
   PHP tiene 21 archivos (15 en `admin/` + 6 en `api/`); con `vercel-php` cada
   archivo seria 1 funcion y el build falla con
   `No more than 12 Serverless Functions can be added to a Deployment`.

**Solucion adoptada:** reescribir el backend en Next.js (App Router). Cada *ruta*
de Next es **una** funcion agrupada, no una por archivo, asi que el limite de 12
no se alcanza. La base de datos es externa (Neon).

---

## 1. Crear la base de datos en Neon

1. Entra en <https://neon.tech>, crea un proyecto (region `us-east-1` / `aws`,
   para que quede cerca de la region `iad1` de Vercel).
2. Copia **dos** cadenas de conexion:
   - **`DATABASE_URL`** — la del **pooler** (`...-pooler...`). La usa el runtime
     serverless, que abre muchas conexiones cortas.
   - **`DIRECT_URL`** — la directa, **sin** pooler. La usan las migraciones.
3. Anade `?sslmode=require` si Neon no lo incluye ya.

---

## 2. Subir el proyecto a Vercel

### Opcion A · Con la CLI

```bash
npm i -g vercel
vercel login
vercel            # despliegue de vista previa
vercel --prod     # despliegue de produccion
```

### Opcion B · Con GitHub

Conecta el repositorio en el panel de Vercel. `vercel.json` ya define:
`framework: nextjs`, `buildCommand: prisma generate && next build` y la region
`iad1`.

---

## 3. Variables de entorno

En **Vercel > Project > Settings > Environment Variables** (marca *Production*,
*Preview* y *Development*), define:

| Variable | Obligatoria | Valor |
|---|---|---|
| `DATABASE_URL` | Si | Cadena del **pooler** de Neon |
| `DIRECT_URL` | Si | Cadena directa (sin pooler) de Neon |
| `APP_SITE_URL` | Si | `https://tu-dominio.com` |
| `APP_KEY` | Si | Cadena larga y aleatoria (firma CSRF/captcha) |
| `MAIL_TRANSPORT` | No | `smtp` (recomendado), `mail` o `log` |
| `MAIL_SMTP_HOST` | Si `smtp` | `smtp.gmail.com` |
| `MAIL_SMTP_PORT` | Si `smtp` | `587` |
| `MAIL_SMTP_USER` | Si `smtp` | Tu cuenta SMTP |
| `MAIL_SMTP_PASS` | Si `smtp` | Contrasena de aplicacion |
| `MAIL_SMTP_SECURE` | No | `tls` (587) o `ssl` (465) |
| `MAIL_FROM_NAME` | No | `C-ROTULUS` |
| `MAIL_TO` | No | Destino de los avisos del formulario |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | Para el login con Google |
| `GOOGLE_PLACES_API_KEY` | No | Para las resenas de Google en vivo |

Genera `APP_KEY` con, por ejemplo: `openssl rand -hex 32`.

Con la CLI:
```bash
vercel env add DATABASE_URL production
vercel env add DIRECT_URL production
vercel env add APP_KEY production
# ...
vercel env pull .env.local   # para desarrollo local
```

> `.gitignore` protege `.env` y `.env.local`: **nunca** se suben al repositorio.

---

## 4. Aplicar el esquema y sembrar datos

Las migraciones se ejecutan **desde tu maquina** apuntando a Neon (no en el build,
para no bloquear el despliegue):

```bash
# 1. Crea las tablas
DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require" \
DIRECT_URL="postgresql://.../neondb?sslmode=require" \
npx prisma migrate deploy

# 2. Siembra contenido de ejemplo (solo en tablas vacias)
DATABASE_URL="..." DIRECT_URL="..." npm run db:seed

# 3. (Opcional) Importa los datos del SQLite antiguo
DATABASE_URL="..." DIRECT_URL="..." npm run db:migrate-sqlite -- legacy/app/data/c-rotulus.sqlite
```

> Si no tienes el SQLite original, salta el paso 3: el paso 2 crea contenido de
> ejemplo y el panel permite editarlo.

---

## 5. Dominio, correo y Google

- **Dominio:** Vercel > Settings > Domains. Anade tu dominio y sigue las DNS.
  Actualiza `APP_SITE_URL` y el `[DOMINIO]` de `public/sitemap.xml` /
  `public/robots.txt`.
- **Correo:** usa una **contrasena de aplicacion** de Gmail (no la contrasena
  normal) y verifica el envio con el boton "Enviar correo de prueba" del panel
  (Ajustes > Correo).
- **Google OAuth:** registra la URI de redireccion exacta que muestra
  Ajustes > Google (`https://tu-dominio.com/api/auth?action=google_callback`).

---

## 6. Comprobar que funciona

```bash
curl -s https://tu-dominio.com/api/index.php?resource=health
# -> {"ok":true,"status":"ok","driver":"pgsql"}

curl -s -o /dev/null -w "%{http_code}\n" https://tu-dominio.com/
curl -s -o /dev/null -w "%{http_code}\n" https://tu-dominio.com/admin/login
```

- `health` debe responder `driver: pgsql` (si dice otra cosa, `DATABASE_URL` es
  incorrecta).
- La portada debe cargar los textos de la BD (telefono, servicios, blog...).
- El login del panel debe funcionar y las tablas mostrar filas.

---

## 7. Problemas frecuentes

| Sintoma | Causa probable | Solucion |
|---|---|---|
| `403 Forbidden` en `/admin` | WAF de Vercel con *Attack Challenge Mode* / *Bot Protection* | Desactivalo en Settings > Security, o accede con navegador real |
| `P1001: Can't reach database` | `DATABASE_URL` mal o Neon suspendido | Revisa la cadena y reactiva el proyecto Neon |
| `too many connections` | Se usa la cadena directa en runtime | Usa la del **pooler** en `DATABASE_URL` |
| El login falla con "token invalido" | `APP_KEY` cambia entre despliegues | Fija `APP_KEY` como variable de entorno estable |
| El formulario dice OK pero no llega correo | SMTP mal configurado | Revisa `MAIL_*` y usa el boton de prueba del panel |
| Build falla en `prisma generate` | Falta `DIRECT_URL` | Anade ambas variables antes del build |

---

## 8. Estructura del despliegue

```
public/            Sitio publico estatico (index.html, empresa.html, css, js, assets)
src/app/api/       API publica (settings, content, blog, team, faqs, reviews, contact...)
src/app/admin/     Panel React (Server Actions)
prisma/            Esquema + migraciones PostgreSQL
vercel.json        Config de Vercel (framework, build, region, cabeceras)
```

Cada carpeta de ruta (`src/app/api/<x>`) es **una** funcion serverless: muy por
debajo del limite de 12 del plan Hobby.
