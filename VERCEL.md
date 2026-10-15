# Caso de uso · Despliegue en Vercel (C-ROTULUS)

Esta guía explica cómo publicar C-ROTULUS en **Vercel** y qué hacer con el panel
(`admin/`) y la API (`api/`), que son **PHP**.

> **Conclusión corta y verificada:** en Vercel se publica **solo la web estática**
> (se ve perfecta, gratis y con CDN). El **panel PHP va en Raiola** y la web se
> conecta a él con una línea en `js/main.js`. Motivo: el **plan Hobby de Vercel
> limita a 12 funciones serverless por despliegue** y tu panel tiene **21 archivos
> `.php`**, así que el build **falla**. Además el firewall de Vercel **bloquea
> `/admin`** con `403`. Detalle en la sección 0.

---

## 0. ⭐ El 403 «Forbidden» al pulsar Acceder (diagnóstico real)

Si al pulsar **Acceder** ves una página que solo dice:

```
Forbidden
sfo1::rbzzg-1792030041622-a22da19787f0
```

o un `403` con un identificador tipo `cle1::…` / `sfo1::…`, **ese error NO lo
genera tu PHP: lo genera el firewall (WAF) de Vercel**. La pista está en la
cabecera de respuesta:

```
x-vercel-mitigated: deny       (<- bloqueo duro, solo en /admin/*)
x-vercel-mitigated: challenge  (<- pantalla de verificación, resto de rutas)
```

Y **por qué** ocurre, comprobado paso a paso:

1. El commit que publicó el **runtime PHP** genera **21 funciones serverless**
   (15 en `admin/` + 6 en `api/`, una por archivo `.php`).
2. El **plan Hobby** de Vercel **solo admite 12 funciones por despliegue**. El
   build **falla** con `Error: No more than 12 Serverless Functions can be added
   to a Deployment on the Hobby plan.` (documentación oficial de runtimes).
3. Al fallar el despliegue, Vercel **sigue sirviendo la versión estática antigua**
   del proyecto. En esa versión el `.php` se entrega como archivo y el **WAF**
   bloquea `/admin` (`deny`) y reta el resto (`challenge`). De ahí el 403.

> Regla de oro: **Vercel es para el frontend/texto estático**. Un panel con más de
> ~12 endpoints PHP no cabe en el plan gratuito. Para eso está Raiola.

### Cómo se soluciona (Opción B, la recomendada)

1. Vuelve a dejar en Vercel **solo la web estática** (`.vercelignore` ya excluye
   `api/`, `admin/` y `app/`; `vercel.json` ya no declara ningún runtime PHP).
2. Publica el panel en **Raiola** clonando el repo en `public_html`
   (`DEPLOY-RAIOLA.md`).
3. En `js/main.js`, bloque `0. DATOS EDITABLES`:
   ```js
   var BACKEND_URL = "https://www.c-rotulus.com";   // tu hosting con PHP, SIN barra final
   ```
   Con eso **Acceder**, **Mi cuenta**, el formulario y la API apuntan a Raiola.
   En Vercel la web se ve igual; el panel lo sirve Raiola.
4. (Opcional) Si vuelves a activar PHP en Vercel, **desactiva** antes su firewall:
   **Firewall → Bot Management → Attack Mode → Disable** y revisa **Firewall →
   Custom Rules** (una regla `path /admin` con acción *Deny* bloquearía el panel).

---

## 1. Qué se publica en Vercel

| Parte | Archivos | En Vercel |
|---|---|---|
| Web pública (estática) | `index.html`, `empresa.html`, `css/`, `js/`, `assets/` | ✅ Sí (CDN gratis) |
| Panel + API (PHP) | `admin/`, `api/`, `app/` | ❌ No → se sirve en **Raiola** |
| Base de datos | MySQL / SQLite | En Raiola (no en Vercel) |

El archivo **`.vercelignore`** ya excluye `api/`, `admin/`, `app/`, `deploy/`,
datos locales, `tools/`, `preview/`, documentación interna y el ZIP. Así en Vercel
solo quedan los archivos estáticos y **no hay descargas de `.php`**.

El archivo **`vercel.json`** añade caché de largo plazo para `assets/`, `css/` y
`js/`, `cleanUrls` (URLs sin `.html`) y cabeceras de seguridad. **No declara
ninguna función PHP** (por el límite de 12 del plan Hobby).

---

## 2. Desplegar en Vercel

### Con la CLI

```bash
npm i -g vercel        # una sola vez
vercel login           # abre el navegador para autorizar
vercel                 # despliegue de prueba (preview)
vercel --prod          # despliegue de producción
```

### Desde el panel (con GitHub)

1. Entra en https://vercel.com/new
2. **Import Git Repository** → `pedrocollazo1988/crotulus`.
3. Framework Preset: **Other**. Build/Output: *(vacío)*.
4. **Deploy**. Cada `git push` redepliega solo. (Si el build falla, revisa la
   sección 4: casi siempre es el límite de funciones por haber incluido el PHP.)

### Dominio propio (gratis)

Vercel → **Settings → Domains** → añade tu dominio y sigue las instrucciones DNS.
El HTTPS se genera solo.

---

## 3. Formulario de contacto en la web estática

- **Recomendado**: deja `BACKEND_URL` configurado y el formulario envía a
  `https://www.c-rotulus.com/api/contact.php` (tu Raiola, con captcha y CSRF).
- **Alternativa sin backend** (Formspree, gratis):
  1. Crea un formulario en https://formspree.io y copia tu ID.
  2. En `js/main.js`: `var FORM_ENDPOINT = "https://formspree.io/f/TU_ID";`
  3. En `index.html`, pon la misma URL en el `action` del `<form>`.

---

## 4. Si decides activar PHP en Vercel (Opción A — avanzada)

Solo tiene sentido si **reduces el panel a ≤ 12 endpoints** o pasas a un plan
**Pro**. Con más de 12 archivos `.php`, el despliegue falla por diseño. Si aun así
quieres intentarlo:

1. Añade el runtime en `vercel.json`:
   ```json
   "functions": {
     "api/*.php":   { "runtime": "vercel-php@0.9.0" },
     "admin/*.php": { "runtime": "vercel-php@0.9.0" }
   }
   ```
   (Con 21 archivos: **fallará** por el límite de 12.)
2. Quita `api/`, `admin/`, `app/` de `.vercelignore`.
3. Define variables de entorno en Vercel: `DB_DRIVER/HOST/PORT/NAME/USER/PASSWORD`,
   `SESSION_HANDLER=database`, `APP_KEY`, `APP_SITE_URL`, `MAIL_SMTP_USER/PASS`,
   `MAIL_TO` (el código las lee del entorno; ver `app/config.php`).
4. Usa una **base de datos externa** (Vercel no tiene disco persistente) y las
   **sesiones en BD** (`SESSION_HANDLER=database`, ya implementado en
   `app/lib/session_db.php`).
5. Desactiva el firewall de Vercel que bloquea `/admin` (ver sección 0).

---

## 5. Comprobación rápida tras desplegar

- [ ] `https://TU-PROYECTO.vercel.app/` carga portada, estilos e imágenes.
- [ ] Navegación por anclas y menú móvil funcionan.
- [ ] `https://TU-PROYECTO.vercel.app/empresa` carga la página de empresa.
- [ ] El enlace **Acceder** abre el panel real en Raiola (con `BACKEND_URL`).
- [ ] El formulario muestra "Gracias, hemos recibido tu mensaje".

---

## 6. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| **403 Forbidden `x-vercel-mitigated: deny`** en `/admin/*` | Firewall de Vercel bloquea rutas tipo panel + despliegue fallido | Ver **sección 0**: Opción B (panel en Raiola) y desactivar la regla |
| **403 `x-vercel-mitigated: challenge`** en todas las rutas | Attack Challenge Mode / Bot Protection activo | **Firewall → Bot Management → Attack Mode → Disable** |
| Build falla: **`No more than 12 Serverless Functions`** | Se incluyó el PHP (21 archivos) en el plan Hobby | Quita `api/`, `admin/`, `app/` de `.vercelignore` |
| Al abrir `admin/login.php` **se descarga el `.php`** | El `.php` se sirve como archivo estático | Usa `BACKEND_URL` (panel en Raiola) |
| Error **"No se pudo conectar con la base de datos"** | La web llama a la API sin `BACKEND_URL` | Configura `BACKEND_URL` en `js/main.js` |
| El **correo de contacto no llega** | Sin SMTP en Raiola | Define `MAIL_SMTP_*` (contraseña de aplicación) |
| La web no carga estilos | `css/` o `js/` excluidos | Quítalos de `.vercelignore` |

---

## 7. Editar textos, colores e imágenes

1. **Textos**: en `index.html` y `empresa.html` (teléfono, correo, dirección,
   servicios, FAQ…). En el JS, bloque `0. DATOS EDITABLES` de `js/main.js`.
2. **Colores**: variables CSS al inicio de `css/styles.css`
   (`--azul-principal`, `--azul-hielo`, `--gris`, etc.).
3. **Imágenes**: reemplaza los archivos de `assets/img/` (mismos nombres) y, si
   cambias un SVG de portada, sube el número en `?v=...` en `index.html`.
