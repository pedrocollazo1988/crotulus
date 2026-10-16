import { redirect } from "next/navigation";
import { AuthShell, FieldError } from "@/components/auth-shell";
import { bootstrap } from "@/lib/bootstrap";
import { currentUser } from "@/lib/auth";
import { csrfToken } from "@/lib/csrf";
import { getConfig } from "@/lib/config";
import {
  challengeUser, twoFactorChannelFor, twoFactorDestinationFor, maskDestination,
  CHALLENGE_COOKIE,
} from "@/lib/twofactor";
import { readScopedCookie } from "@/lib/session";

/**
 * ============================================================================
 *  VERIFICACION EN DOS PASOS  ->  /admin/verify-2fa
 * ----------------------------------------------------------------------------
 *  Segundo factor del acceso: el usuario introduce el codigo de 6 digitos que
 *  recibe por correo o SMS. Solo entonces se abre la sesion (lo hace el
 *  endpoint /api/auth?action=verify_2fa).
 * ============================================================================
 */
export const dynamic = "force-dynamic";

export default async function VerifyTwoFactorPage() {
  await bootstrap();
  if (await currentUser()) redirect("/admin/");

  // Sin reto pendiente no hay nada que verificar: de vuelta al acceso.
  const challenge = await readScopedCookie(CHALLENGE_COOKIE);
  const user = await challengeUser(challenge, "login");
  if (!user) redirect("/admin/login?status=2fa_expired");

  const csrf = csrfToken();
  const channel = twoFactorChannelFor(user);
  const destination = twoFactorDestinationFor(user, channel);
  const masked = maskDestination(channel, destination);
  const remember = getConfig().security.twoFactorRememberDevice;

  return (
    <AuthShell
      bullets={[
        "Segundo paso de seguridad",
        "El código caduca en pocos minutos",
        "No lo compartas con nadie",
      ]}
    >
      <form
        id="verify2faForm"
        className="js-auth-form"
        method="post"
        noValidate
        action="/api/auth?action=verify_2fa"
        data-resend-url="/api/auth?action=resend_2fa"
      >
        <h1>Verificación en dos pasos</h1>
        <p className="muted">
          Hemos enviado un código de 6 dígitos a {channel === "sms" ? "tu teléfono" : "tu correo"}{" "}
          <strong>{masked}</strong>.
        </p>
        <div className="alert alert--error" id="verify2faError" role="alert" hidden />
        <div className="alert alert--ok" id="verify2faOk" role="status" hidden />
        <input type="hidden" name="_csrf" value={csrf} />

        <div className="field">
          <label htmlFor="code">Código de verificación</label>
          <input
            type="text" id="code" name="code" data-validate="otp" inputMode="numeric"
            autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} required
            placeholder="000000"
          />
          <FieldError name="code" />
        </div>

        {remember ? (
          <div className="field">
            <label>
              <input type="checkbox" name="remember" value="1" defaultChecked /> Recordar este dispositivo
            </label>
          </div>
        ) : null}

        <button className="btn btn--block" type="submit">Verificar y entrar</button>

        <div className="links">
          <button type="button" className="btn-link" id="resend2fa">Reenviar código</button>
          <span aria-hidden="true">·</span>
          <a href="/admin/login">Volver al acceso</a>
        </div>
      </form>
    </AuthShell>
  );
}
