# Caso de uso · Despliegue en Vercel (C-ROTULUS)

Esta guía explica cómo publicar C-ROTULUS en **Vercel** y cómo hacer que **el panel
(`admin/`) y la API (`api/`) funcionen allí**, ejecutando PHP de verdad.

> Resumen: Vercel **sí puede ejecutar PHP** usando el runtime comunitario
> `vercel-php`. Lo que Vercel **no** da es un disco persistente, así que la base
> de datos y las sesiones deben vivir **fuera** del contenedor (una base de datos
> externa). Si no quieres montar eso, usa la Opción B (web estática en Vercel +
> panel en Raiola). Ambas están detalladas abajo.

---

## 1. Qué funciona y qué no en Vercel

| Parte | Archivos | En Vercel |
|---|---|---|
| Web pública (estática) | `index.html`, `empresa.html`, `css/`, `js/`, `assets/` | ✅ Perfecto (CDN gratis) |
| PHP (`api/`, `admin/`) | código PHP | ✅ Con el runtime `vercel-php` |
| Base de datos | MySQL o SQLite | ⚠️ Debe ser **externa** (ver 2.A) |
| Sesiones de login | tabla `php_sessions` | ✅ Con `SESSION_HANDLER=database` |

Dos limitaciones reales de Vercel (serverless), ya resueltas en el código:

1. **Disco de solo lectura / efímero.** No se puede crear ni conservar la base
   SQLite en el proyecto. Solución: base de datos externa (PlanetScale, Railway,
   Aiven, Clever Cloud… casi todas con plan gratis) y **sesiones en la base de
   datos** (`SESSION_HANDLER=database`, ya implementado).
2. **Sin correo `mail()` local.** Ya resuelto: el mailer usa **SMTP** (Gmail), que
   sí funciona desde Vercel. Configura `MAIL_SMTP_USER` y `MAIL_SMTP_PASS`.

---

## 2. Dos formas de usar Vercel

### Opción A — Todo en Vercel (PHP incluido) + base de datos externa

Con esta opción el **login y la API funcionan en el propio dominio de Vercel**.

Requisitos:
- El proyecto ya trae `vercel.json` con el runtime PHP declarado:
  ```json
  "functions": {
    "api/*.php":   { "runtime": "vercel-php@0.7.4" },
    "admin/*.php": { "runtime": "vercel-php@0.7.4" }
  }
  ```
- Una **base de datos externa** accesible por red (MySQL recomendado).

Pasos:

1. Sube el proyecto a Vercel (sección 3).
2. En **Settings → Environment Variables** define las credenciales. El código las
   lee del entorno (no hace falta editar `config.php`):

   | Variable | Valor de ejemplo |
   |---|---|
   | `DB_DRIVER` | `mysql` |
   | `DB_HOST` | `tu-host.db-provider.com` |
   | `DB_PORT` | `3306` |
   | `DB_NAME` | `crotulus` |
   | `DB_USER` | `crotulus_user` |
   | `DB_PASSWORD` | *(tu contraseña)* |
   | `SESSION_HANDLER` | `database` |
   | `APP_KEY` | *(cadena larga y aleatoria)* |
   | `APP_SITE_URL` | `https://tu-proyecto.vercel.app` |
   | `MAIL_SMTP_USER` | `crotulus.mipyme@gmail.com` |
   | `MAIL_SMTP_PASS` | *(contraseña de aplicación de Gmail)* |

3. La primera visita a `admin/login.php` crea las tablas y el usuario inicial
   (revisa el aviso de arranque que muestra el propio panel).

> 💡 **Consejo**: si el proveedor de BD **no está en la misma región** que la
> función de Vercel, cada consulta paga latencia de red. Elige una región cercana
> (p. ej. `fra1` / Frankfurt) tanto en Vercel como en la base de datos.

### Opción B — Web estática en Vercel + panel en tu hosting con PHP  *(la más simple)*

Aprovecha lo mejor de cada sitio: Vercel (CDN global, gratis) para la web pública
y **Raiola** (o cualquier hosting con PHP) para el panel.

1. **Sitio estático en Vercel** (sección 3).
2. **Panel PHP en Raiola** (`DEPLOY-RAIOLA.md`, clonando el repo en `public_html`).
3. **Conecta ambos** en `js/main.js`:

   ```js
   var BACKEND_URL = "https://www.c-rotulus.com";   // tu hosting con PHP, SIN barra final
   ```

   Con eso, los enlaces **"Acceder" / "Mi cuenta"** y las llamadas a la API
   apuntan a tu backend real. Si prefieres no mezclar dominios, deja
   `BACKEND_URL = ""` y quita esos enlaces de `index.html` / `empresa.html`.

---

## 3. Desplegar en Vercel

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
4. **Deploy**. Cada `git push` redepliega solo.

> ⚠️ Si vas a usar la **Opción B**, añade `api/`, `admin/`, `app/` a
> `.vercelignore` para no publicar el PHP como archivos estáticos (Vercel los
> descargaría en vez de ejecutarlos). Para la **Opción A**, déjalos incluidos.

### Dominio propio (gratis)

Vercel → **Settings → Domains** → añade tu dominio y sigue las instrucciones DNS.
El certificado HTTPS se genera solo.

---

## 4. Formulario de contacto

- **Opción A** (PHP en Vercel): funciona `api/contact.php` con captcha y CSRF.
- **Opción B** (solo estático): usa un servicio externo, p. ej. Formspree:
  1. Crea un formulario gratis en https://formspree.io y copia tu ID.
  2. En `js/main.js`: `var FORM_ENDPOINT = "https://formspree.io/f/TU_ID";`
  3. En `index.html`, pon el mismo valor en el `action` del `<form>`.

---

## 5. Comprobación rápida tras desplegar

- [ ] `https://TU-PROYECTO.vercel.app/` carga portada, estilos e imágenes.
- [ ] Navegación por anclas y menú móvil funcionan.
- [ ] `https://TU-PROYECTO.vercel.app/empresa` carga la página de empresa.
- [ ] (Opción A) `admin/login.php` muestra el formulario de acceso y permite
      iniciar sesión; la sesión se mantiene al navegar.
- [ ] El formulario muestra "Gracias, hemos recibido tu mensaje".

---

## 6. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| Al abrir `admin/login.php` **se descarga un `.php`** | `admin/` está excluido en `.vercelignore` pero el enlace sigue ahí | Opción A: quita `admin/` de `.vercelignore`. Opción B: configura `BACKEND_URL` |
| Error **"No se pudo conectar con la base de datos"** | Faltan las variables `DB_*` o la BD no es accesible | Revisa las Environment Variables y el firewall del proveedor |
| **El login no se mantiene** (vuelve a pedir acceso) | Faltó `SESSION_HANDLER=database` | Añade esa variable de entorno |
| El **correo de contacto no llega** | Sin SMTP | Define `MAIL_SMTP_USER` y `MAIL_SMTP_PASS` (contraseña de aplicación) |
| La web no carga estilos | `css/` o `js/` excluidos | Quítalos de `.vercelignore` |
| El dominio propio no resuelve | DNS | Espera la propagación (hasta 24-48 h) |

---

## 7. Editar textos, colores e imágenes

1. **Textos**: en `index.html` y `empresa.html` (teléfono, correo, dirección,
   servicios, FAQ…). En el JS, bloque `0. DATOS EDITABLES` de `js/main.js`.
2. **Colores**: variables CSS al inicio de `css/styles.css`
   (`--azul-principal`, `--azul-hielo`, `--gris`, etc.).
3. **Imágenes**: reemplaza los archivos de `assets/img/` (mismos nombres) y, si
   cambias un SVG de portada, sube el número en `?v=...` en `index.html`.
