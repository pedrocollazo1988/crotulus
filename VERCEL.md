# Caso de uso · Despliegue GRATIS en Vercel (C-ROTULUS)

Esta guía explica cómo publicar la web de C-ROTULUS en **Vercel** (plan Hobby,
gratis) y por qué **los enlaces a `admin/login.php` no funcionan** allí, con las
dos soluciones posibles.

> Resumen de una línea: Vercel sirve la web estática perfectamente, pero **no
> ejecuta PHP ni guarda base de datos**, así que el panel (`admin/`) y la API
> (`api/`) tienen que vivir en otro hosting con PHP (tu Raiola). Configúralo en
> una sola línea: `var BACKEND_URL = "https://www.c-rotulus.com";` en `js/main.js`.

---

## 1. Por qué fallan los enlaces de login en Vercel

Tu proyecto tiene **dos partes**:

| Parte | Archivos | Necesita |
|---|---|---|
| Web pública (estática) | `index.html`, `empresa.html`, `css/`, `js/`, `assets/` | Solo servir archivos → **Vercel sí** |
| Panel + API | `admin/`, `api/`, `app/` (todo `.php`) | **PHP 8** y base de datos → Vercel **NO** |

Vercel es una plataforma de **contenido estático + funciones serverless**
(Node, Python, Go, Ruby). **No incluye un intérprete de PHP** y su sistema de
archivos es **de solo lectura** (no puede crear ni escribir la base de datos
SQLite del panel). Por eso, al entrar en `admin/login.php`:

- Si **sí** subiste la carpeta `admin/`, Vercel ve un `.php` como archivo
  cualquiera y el navegador **lo descarga** en vez de mostrar la página → "no
  funciona el login".
- Si **no** subiste `admin/` (con `.vercelignore`), el enlace da **404**.

En ninguno de los dos casos hay sesión, contraseñas ni base de datos: el login
es materialmente imposible dentro de Vercel.

---

## 2. Decisión: ¿qué quieres hacer?

### Opción A — Web estática en Vercel + panel en tu hosting con PHP  *(recomendada)*

Es la que aprovecha lo mejor de cada plataforma: Vercel (CDN global, gratis,
HTTPS, dominio propio) para la web pública, y **Raiola** para el panel PHP.

1. **Sitio estático en Vercel** (paso 4).
2. **Panel PHP en Raiola** (clona el repo completo en `public_html`, según
   `DEPLOY-RAIOLA.md`).
3. **Conecta ambos**: en `js/main.js` escribe la URL de tu hosting con PHP:

   ```js
   var BACKEND_URL = "https://www.c-rotulus.com";   // tu dominio con PHP, SIN barra final
   ```

   Con eso, el enlace **"Acceder"** y **"Mi cuenta"** de la cabecera, y las
   llamadas a la API (datos, reseñas, blog…), apuntarán a tu backend real. La
   web seguirá viéndose en Vercel; el panel lo sirve Raiola.

   > Si prefieres NO mezclar: deja `BACKEND_URL = ""` y elimina el enlace
   > "Acceder" del `index.html`/`empresa.html` (así no habrá enlaces rotos).

### Opción B — Todo el sitio en un hosting con PHP (sin Vercel)

Sube **todo** a Raiola (o cualquier hosting con PHP) y olvídate de Vercel.
Es lo más simple: el panel, la API y la web funcionan en el mismo dominio.
Sigue `DEPLOY.md` o `DEPLOY-RAIOLA.md`.

---

## 3. Qué sube y qué NO sube a Vercel

El archivo **`.vercelignore`** (en la raíz del proyecto) ya está preparado:
excluye `api/`, `admin/`, `app/`, `deploy/`, los datos (`*.sqlite`, `*.log`),
`tools/`, `preview/`, la documentación interna y el ZIP.

Resultado: en Vercel solo se publican los archivos estáticos. Así **no hay
descargas raras de `.php`** ni archivos internos expuestos.

El archivo **`vercel.json`** ya añade caché de largo plazo para `assets/`,
`css/` y `js/`, `cleanUrls` (URLs sin `.html`) y cabeceras de seguridad.

---

## 4. Pasos para desplegar gratis en Vercel

### Opción rápida — con la CLI

```bash
# 1. Instala la CLI (una sola vez)
npm i -g vercel

# 2. Entra en la carpeta del proyecto y accede con tu cuenta
cd /ruta/al/proyecto
vercel login

# 3. Despliegue de prueba (preview). Acepta los valores por defecto.
vercel

# 4. Despliegue de producción (tu dominio .vercel.app)
vercel --prod
```

### Opción desde el panel de Vercel (con GitHub)

1. Entra en https://vercel.com/new
2. **Import Git Repository** → elige `pedrocollazo1988/crotulus`.
3. Framework Preset: **Other**. Build Command: *(vacío)*. Output Directory: *(vacío)*.
4. **Deploy**. A partir de ahí, cada `git push` redepliega solo.

### Dominio propio (gratis)

En el proyecto de Vercel → **Settings → Domains** → añade tu dominio y sigue las
instrucciones de DNS. El certificado HTTPS se genera automáticamente.

---

## 5. Formulario de contacto en Vercel (importante)

El formulario, tal cual, usa el **backend PHP** (`api/contact.php`) para
captcha y CSRF. En Vercel ese backend no existe. Para que el formulario
funcione en el sitio estático tienes dos caminos:

- **Usar el backend de Raiola** (Opción A): deja `BACKEND_URL` configurado y el
  formulario enviará a `https://www.c-rotulus.com/api/contact.php`. *(El captcha
  y el CSRF viven en PHP; para uso cruzado entre dominios puede requerir ajustar
  CORS/sesión. Lo más limpio es la opción siguiente.)*
- **Usar un servicio externo (Formspree, gratis)** — recomendado para Vercel:

  1. Crea un formulario gratis en https://formspree.io y copia tu ID.
  2. En `js/main.js`:

     ```js
     var FORM_ENDPOINT = "https://formspree.io/f/TU_ID";
     ```

  3. En `index.html`, cambia también el `action` del `<form>` por la misma URL.
  4. Con `BACKEND_URL` vacío, el aviso "Formulario no configurado" desaparece y
     los mensajes llegan a tu correo.

---

## 6. Comprobación rápida tras desplegar

- [ ] `https://TU-PROYECTO.vercel.app/` carga la portada con imágenes y estilos.
- [ ] Navegación por anclas y menú móvil funcionan.
- [ ] `https://TU-PROYECTO.vercel.app/empresa` carga la página de empresa.
- [ ] El enlace **"Acceder"** abre tu panel real (si configuraste `BACKEND_URL`)
      o ya no existe (si lo quitaste).
- [ ] El formulario muestra "Gracias, hemos recibido tu mensaje" (con Formspree).

---

## 7. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| Al pulsar "Acceder" **se descarga un archivo `.php`** | Vercel sirve el `.php` como estático | Añade `admin/` a `.vercelignore` y usa `BACKEND_URL` |
| "Acceder" da **404** | `admin/` está excluido y no hay backend | Configura `BACKEND_URL` o elimina el enlace |
| El **formulario no envía** | No hay PHP/captcha en Vercel | Usa Formspree (sección 5) |
| La web no carga estilos | `vercel.json`/rutas | Revisa que `css/` y `js/` no estén en `.vercelignore` |
| El dominio propio no resuelve | DNS | Espera la propagación (hasta 24-48 h) y revisa los registros |

---

## 8. Editar textos, colores e imágenes

1. **Textos**: en `index.html` y `empresa.html` (teléfono, correo, dirección,
   servicios, FAQ…). En el JS, bloque `0. DATOS EDITABLES` de `js/main.js`.
2. **Colores**: variables CSS al inicio de `css/styles.css`
   (`--azul-principal`, `--azul-hielo`, `--gris`, etc.).
3. **Imágenes**: reemplaza los archivos de `assets/img/` (mismos nombres) y, si
   cambias un SVG de portada, sube el número en `?v=...` en `index.html`.
