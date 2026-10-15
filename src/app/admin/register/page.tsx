import { redirect } from "next/navigation";
import { AuthShell, GoogleButton, FieldError } from "@/components/auth-shell";
import { bootstrap } from "@/lib/bootstrap";
import { currentUser, googleEnabled } from "@/lib/auth";
import { csrfToken } from "@/lib/csrf";
import { getConfig } from "@/lib/config";

/**
 * ============================================================================
 *  CREAR CUENTA  ->  /admin/register
 *  Puerto de admin/register.php. El primer usuario se convierte en admin.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  await bootstrap();
  if (await currentUser()) redirect("/admin/");

  const csrf = csrfToken();
  const min = getConfig().security.passwordMin;
  const google = await googleEnabled();

  return (
    <AuthShell
      bullets={[
        "Crea tu cuenta de administrador",
        "Verificación por correo electrónico",
        "Acceso con Google disponible",
      ]}
    >
      <form
        id="registerForm"
        className="js-auth-form"
        method="post"
        noValidate
        action="/api/auth?action=register"
        data-success-url="/admin/login?status=registered"
      >
        <h1>Crear cuenta</h1>
        <div className="alert alert--error" id="regError" role="alert" hidden />
        <div className="alert alert--info">
          La contraseña debe tener al menos {min} caracteres e incluir una letra y un número.
        </div>
        <input type="hidden" name="_csrf" value={csrf} />

        <div className="field">
          <label htmlFor="name">Nombre y apellidos</label>
          <input
            type="text" id="name" name="name" data-validate="name"
            autoComplete="name" required maxLength={120} placeholder="Ej.: María López"
          />
          <FieldError name="name" />
        </div>

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
              autoComplete="new-password" required data-min={min}
            />
            <button type="button" className="pw-toggle" data-pw-toggle="password" aria-label="Mostrar contraseña">Mostrar</button>
          </div>
          <div className="strength" data-strength-for="password" data-score="0">
            <div className="strength__bars" aria-hidden="true">
              <span className="strength__bar" /><span className="strength__bar" />
              <span className="strength__bar" /><span className="strength__bar" />
            </div>
            <span className="strength__text" aria-live="polite" />
          </div>
          <FieldError name="password" />
        </div>

        <button className="btn btn--block" type="submit">Crear cuenta</button>
        <GoogleButton enabled={google} />

        <div className="links">
          ¿Ya tienes cuenta? <a href="/admin/login">Inicia sesión</a>
        </div>
      </form>
    </AuthShell>
  );
}
