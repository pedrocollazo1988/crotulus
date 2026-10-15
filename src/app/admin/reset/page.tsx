import { redirect } from "next/navigation";
import { AuthShell, FieldError } from "@/components/auth-shell";
import { Alert } from "@/components/admin-ui";
import { bootstrap } from "@/lib/bootstrap";
import { csrfToken, csrfVerify } from "@/lib/csrf";
import { validatePassword } from "@/lib/validator";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/db";
import { tokenHash } from "@/lib/session";
import { audit } from "@/lib/admin";
import { getConfig } from "@/lib/config";

/**
 * ============================================================================
 *  RESTABLECER CONTRASENA  ->  /admin/reset?token=...
 *  Puerto de admin/reset.php. Valida el token antes de mostrar el formulario.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

/** Busca el usuario dueno de un token de reseteo valido. */
async function userForToken(token: string) {
  if (token === "") return null;
  const row = await prisma.token.findFirst({
    where: {
      type: "password_reset",
      tokenHash: tokenHash(token),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });
  return row?.user ?? null;
}

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await bootstrap();
  const sp = await searchParams;
  const token = typeof sp["token"] === "string" ? sp["token"] : "";
  const csrf = csrfToken();
  const min = getConfig().security.passwordMin;

  const user = await userForToken(token);

  // Server Action: procesa el cambio de contrasena.
  async function submit(formData: FormData) {
    "use server";
    await bootstrap();
    const data: Record<string, string> = {};
    formData.forEach((v, k) => (data[k] = typeof v === "string" ? v : ""));
    const t = data["token"] ?? "";
    const target = await userForToken(t);

    if (!csrfVerify(data["_csrf"])) {
      redirect(`/admin/reset?token=${encodeURIComponent(t)}&err=${encodeURIComponent("Token de seguridad inválido. Recarga la página.")}`);
    }
    if (!target) {
      redirect(`/admin/reset?token=${encodeURIComponent(t)}&err=${encodeURIComponent("El enlace ha caducado o ya se ha usado.")}`);
    }
    const pass = data["password"] ?? "";
    const pass2 = data["password2"] ?? "";
    const errs = validatePassword(pass, min, getConfig().security.passwordMax);
    if (errs.length) {
      redirect(`/admin/reset?token=${encodeURIComponent(t)}&err=${encodeURIComponent(errs.join(" "))}`);
    }
    if (pass !== pass2) {
      redirect(`/admin/reset?token=${encodeURIComponent(t)}&err=${encodeURIComponent("Las contraseñas no coinciden.")}`);
    }

    const now = new Date();
    await prisma.user.update({
      where: { id: target.id },
      data: {
        passwordHash: await hashPassword(pass),
        emailVerifiedAt: target.emailVerifiedAt ?? now,
        status: target.status === "pending" ? "active" : target.status,
        updatedAt: now,
      },
    });
    await prisma.token.updateMany({
      where: { type: "password_reset", userId: target.id, usedAt: null },
      data: { usedAt: now },
    });
    await prisma.session.updateMany({
      where: { userId: target.id, revokedAt: null },
      data: { revokedAt: now },
    });
    await audit("password_reset", { id: target.id });
    redirect("/admin/login?status=reset");
  }

  const err = typeof sp["err"] === "string" ? sp["err"] : "";
  const done = typeof sp["done"] === "string";

  return (
    <AuthShell
      bullets={[
        "Elige una contraseña segura",
        "Se cerrarán las sesiones abiertas",
        "Podrás entrar con la nueva al instante",
      ]}
    >
      {done ? (
        <>
          <Alert kind="ok">Contraseña actualizada correctamente.</Alert>
          <p style={{ textAlign: "center" }}>
            <a className="btn" href="/admin/login?status=reset">Iniciar sesión</a>
          </p>
        </>
      ) : !user ? (
        <>
          <Alert kind="error">El enlace de recuperación no es válido o ha caducado.</Alert>
          <p style={{ textAlign: "center" }}>
            <a className="btn btn--ghost" href="/admin/forgot">Pedir un enlace nuevo</a>
          </p>
        </>
      ) : (
        <form id="resetForm" className="js-auth-form" method="post" noValidate action={submit}>
          <h1>Nueva contraseña</h1>
          {err ? <Alert kind="error">{err}</Alert> : null}
          <input type="hidden" name="_csrf" value={csrf} />
          <input type="hidden" name="token" value={token} />

          <div className="field">
            <label htmlFor="password">Contraseña nueva</label>
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

          <div className="field">
            <label htmlFor="password2">Repite la contraseña</label>
            <input
              type="password" id="password2" name="password2" data-validate="password2"
              autoComplete="new-password" required
            />
            <FieldError name="password2" />
          </div>

          <button className="btn btn--block" type="submit">Guardar contraseña</button>
          <div className="links"><a href="/admin/login">Volver al inicio de sesión</a></div>
        </form>
      )}
    </AuthShell>
  );
}
