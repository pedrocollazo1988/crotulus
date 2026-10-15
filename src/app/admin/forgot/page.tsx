import { AuthShell, FieldError } from "@/components/auth-shell";
import { bootstrap } from "@/lib/bootstrap";
import { csrfToken } from "@/lib/csrf";

/**
 * ============================================================================
 *  OLVIDE MI CONTRASENA  ->  /admin/forgot
 *  Puerto de admin/forgot.php. La respuesta es identica exista o no la cuenta.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

export default async function ForgotPage() {
  await bootstrap();
  const csrf = csrfToken();

  return (
    <AuthShell
      bullets={[
        "Te enviamos un enlace seguro",
        "Válido durante una hora",
        "Al cambiarla, se cierran las sesiones abiertas",
      ]}
    >
      <form
        id="forgotForm"
        className="js-auth-form"
        method="post"
        noValidate
        action="/api/auth?action=forgot"
      >
        <h1>Recuperar contraseña</h1>
        <p className="muted">
          Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.
        </p>

        <div className="alert alert--ok" id="forgotOk" role="status" hidden />
        <div className="alert alert--error" id="forgotError" role="alert" hidden />
        <input type="hidden" name="_csrf" value={csrf} />

        <div className="field">
          <label htmlFor="email">Tu correo electrónico</label>
          <input
            type="email" id="email" name="email" data-validate="email"
            autoComplete="email" inputMode="email" required placeholder="nombre@dominio.com"
          />
          <FieldError name="email" />
        </div>

        <button className="btn btn--block" type="submit">Enviar enlace</button>

        <div className="links">
          <a href="/admin/login">Volver al inicio de sesión</a>
          <span aria-hidden="true">·</span>
          <a href="/admin/register">Crear una cuenta</a>
        </div>
      </form>
    </AuthShell>
  );
}
