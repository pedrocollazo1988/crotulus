import { redirect } from "next/navigation";
import { AuthShell, GoogleButton, FieldError } from "@/components/auth-shell";
import { Alert } from "@/components/admin-ui";
import { bootstrap } from "@/lib/bootstrap";
import { currentUser, googleEnabled } from "@/lib/auth";
import { csrfToken } from "@/lib/csrf";
import { getConfig } from "@/lib/config";

/**
 * ============================================================================
 *  INICIAR SESION  ->  /admin/login
 *  Puerto de admin/login.php. El JS (admin-auth.js) intercepta el envio y lo
 *  manda por fetch a /api/auth?action=login.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

const NOTICES: Record<string, { kind: "ok" | "info"; text: string }> = {
  registered: { kind: "ok", text: "Cuenta creada. Revisa tu correo para verificarla." },
  verified: { kind: "ok", text: "Correo verificado. Ya puedes iniciar sesión." },
  reset: { kind: "ok", text: "Contraseña actualizada. Inicia sesión con la nueva." },
  google_off: {
    kind: "info",
    text: "El acceso con Google aún no está configurado. Un administrador debe añadir el Client ID y el Client secret en Ajustes.",
  },
  google_bad: {
    kind: "info",
    text: "El acceso con Google está mal configurado. Un administrador debe revisar las credenciales en Ajustes · Google.",
  },
  "2fa_expired": {
    kind: "info",
    text: "La verificación en dos pasos ha caducado. Vuelve a iniciar sesión.",
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await bootstrap();
  if (await currentUser()) redirect("/admin/");

  const sp = await searchParams;
  const status = typeof sp["status"] === "string" ? sp["status"] : "";
  const notice = NOTICES[status];
  const csrf = csrfToken();
  const min = getConfig().security.passwordMin;
  const google = await googleEnabled();

  return (
    <AuthShell
      bullets={[
        "Gestiona mensajes y contenido del sitio",
        "Acceso protegido con doble validación",
        "Disponible para el equipo de C-ROTULUS",
      ]}
    >
      {notice ? <Alert kind={notice.kind}>{notice.text}</Alert> : null}

      <form
        id="loginForm"
        className="js-auth-form"
        method="post"
        noValidate
        action="/api/auth?action=login"
        data-success-url="/admin/account"
        data-admin-url="/admin/"
      >
        <h1>Iniciar sesión</h1>
        <div className="alert alert--error" id="loginError" role="alert" hidden />
        <input type="hidden" name="_csrf" value={csrf} />

        <div className="field">
          <label htmlFor="email">Correo electrónico</label>
          <input
            type="email" id="email" name="email" data-validate="email"
            autoComplete="email" inputMode="email" required placeholder="nombre@dominio.com"
          />
          <FieldError name="email" />
        </div>

        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <div className="pw-wrap">
            <input
              type="password" id="password" name="password" data-validate="password"
              autoComplete="current-password" required data-min={min}
            />
            <button type="button" className="pw-toggle" data-pw-toggle="password" aria-label="Mostrar contraseña">Mostrar</button>
          </div>
          <FieldError name="password" />
        </div>

        <button className="btn btn--block" type="submit">Entrar</button>
        <GoogleButton enabled={google} />

        <div className="links">
          <a href="/admin/forgot">Olvidé mi contraseña</a>
          <span aria-hidden="true">·</span>
          <a href="/admin/register">Crear una cuenta</a>
        </div>
      </form>
    </AuthShell>
  );
}
