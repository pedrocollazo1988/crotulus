import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Alert, Badge, Cards, Field, Stat, statusTone } from "@/components/admin-ui";
import { FieldError } from "@/components/auth-shell";
import { requireLogin } from "@/lib/admin-guard";
import { csrfToken, csrfVerify } from "@/lib/csrf";
import { validateSubmission, e } from "@/lib/validator";
import {
  submissionsEnabled, submissionsAutoApprove, submissionTypeLabel, submissionsForUser,
} from "@/lib/submissions";
import { mailerTemplate, mailNotifyTo, sendMail } from "@/lib/mailer";
import { getConfig } from "@/lib/config";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/admin";

/**
 * ============================================================================
 *  MI CUENTA  ->  /admin/account
 *  Puerto de admin/account.php. Aportaciones (testimonio / pregunta) + listado.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireLogin();
  const sp = await searchParams;
  const flashOk = typeof sp["ok"] === "string" ? sp["ok"] : "";
  const flashErr = typeof sp["err"] === "string" ? sp["err"] : "";
  const csrf = csrfToken();

  const [aportaciones, enabled, autoApprove, published, pending] = await Promise.all([
    submissionsForUser(user.id, 20),
    submissionsEnabled(),
    submissionsAutoApprove(),
    prisma.userSubmission.count({ where: { userId: user.id, status: "aprobada" } }),
    prisma.userSubmission.count({ where: { userId: user.id, status: "pendiente" } }),
  ]);
  const esAdmin = user.role === "admin";

  /** Server Action: envia una aportacion. */
  async function submit(formData: FormData) {
    "use server";
    const me = await requireLogin();
    const data: Record<string, string> = {};
    formData.forEach((v, k) => (data[k] = typeof v === "string" ? v : ""));

    if (!csrfVerify(data["_csrf"])) {
      redirect(`/admin/account?err=${encodeURIComponent("Token de seguridad inválido. Vuelve a intentarlo.")}`);
    }
    if (!(await submissionsEnabled())) {
      redirect(`/admin/account?err=${encodeURIComponent("Las aportaciones están desactivadas en este momento.")}`);
    }

    const result = validateSubmission({ tipo: data["tipo"], titulo: data["titulo"], texto: data["texto"] });
    if (Object.keys(result.errors).length) {
      redirect(`/admin/account?err=${encodeURIComponent(Object.values(result.errors).join(" "))}`);
    }
    const d = result.data;
    const status = (await submissionsAutoApprove()) ? "aprobada" : "pendiente";
    const now = new Date();

    const row = await prisma.userSubmission.create({
      data: {
        userId: me.id, stype: d.stype, title: d.title, body: d.body,
        status, ip: "", createdAt: now, updatedAt: now,
      },
    });
    await audit("submission_created", { id: row.id, type: d.stype, user: me.id });

    const tipo = submissionTypeLabel(d.stype);
    const autor = me.name || me.email;
    const html = mailerTemplate(
      `Nueva aportación: ${tipo}`,
      `<p><strong>Tipo:</strong> ${e(tipo)}</p>
       <p><strong>Autor:</strong> ${e(autor)}</p>
       <p><strong>Título:</strong> ${e(d.title)}</p>
       <p><strong>Detalle:</strong></p><p>${e(d.body).replace(/\n/g, "<br>")}</p>
       <p><em>Estado: ${status}.</em></p>`,
    );
    const notify = await mailNotifyTo();
    if (notify) await sendMail(notify, `Nueva aportación · ${getConfig().siteName}`, html);

    const msg = status === "aprobada"
      ? "¡Gracias! Tu aportación ya está publicada."
      : "¡Gracias! Tu aportación se revisará antes de publicarse.";
    revalidatePath("/admin/account");
    redirect(`/admin/account?ok=${encodeURIComponent(msg)}`);
  }

  return (
    <>
      <h1>Mi cuenta</h1>
      {flashOk ? <Alert kind="ok">{flashOk}</Alert> : null}
      {flashErr ? <Alert kind="error">{flashErr}</Alert> : null}

      <Cards>
        <Stat num={aportaciones.length} label="Aportaciones enviadas" />
        <Stat num={published} label="Publicadas" />
        <Stat num={pending} label="En revisión" />
        <Stat num={esAdmin ? "Admin" : "Usuario"} label="Tipo de cuenta" />
      </Cards>

      <p className="muted">
        Has iniciado sesión como <strong>{user.name || user.email}</strong>.{" "}
        {esAdmin ? (
          <>Tienes permisos de administrador: <a href="/admin/">ir al panel de gestión</a>.</>
        ) : null}
      </p>

      {!enabled ? (
        <Alert kind="info">Las aportaciones están desactivadas en este momento.</Alert>
      ) : (
        <div className="grid-2">
          <form className="js-account-form" method="post" noValidate action={submit}>
            <div className="settings-card">
              <h2>Comparte tu testimonio</h2>
              <p className="muted">Cuenta tu experiencia con C-ROTULUS. Se revisará antes de publicarse.</p>
              <input type="hidden" name="_csrf" value={csrf} />
              <input type="hidden" name="tipo" value="testimonio" />
              <Field label="Tu nombre" htmlFor="tTitle">
                <input type="text" id="tTitle" name="titulo" data-validate="name" required maxLength={120} autoComplete="name" />
                <FieldError name="titulo" />
              </Field>
              <Field label="Tu experiencia" htmlFor="tText">
                <textarea id="tText" name="texto" data-validate="text" required minLength={10} maxLength={1500} rows={4} />
                <FieldError name="texto" />
              </Field>
              <button className="btn" type="submit">Enviar testimonio</button>
              <div className="alert alert--ok" data-account-ok role="status" hidden />
              <div className="alert alert--error" data-account-error role="alert" hidden />
            </div>
          </form>

          <form className="js-account-form" method="post" noValidate action={submit}>
            <div className="settings-card">
              <h2>Propón una pregunta</h2>
              <p className="muted">¿Echas en falta alguna duda en las preguntas frecuentes? Proponla y la valoramos.</p>
              <input type="hidden" name="_csrf" value={csrf} />
              <input type="hidden" name="tipo" value="pregunta" />
              <Field label="Tu pregunta" htmlFor="qTitle">
                <input
                  type="text" id="qTitle" name="titulo" data-validate="question" required
                  minLength={8} maxLength={200}
                  placeholder="Ej.: ¿Podéis migrar mi web actual sin perder posicionamiento?"
                />
                <FieldError name="titulo" />
              </Field>
              <Field label="Detalle (opcional)" htmlFor="qText">
                <textarea id="qText" name="texto" maxLength={1500} rows={4} />
                <FieldError name="texto" />
              </Field>
              <button className="btn" type="submit">Enviar pregunta</button>
              <div className="alert alert--ok" data-account-ok role="status" hidden />
              <div className="alert alert--error" data-account-error role="alert" hidden />
            </div>
          </form>
        </div>
      )}

      <h2>Mis aportaciones</h2>
      {aportaciones.length === 0 ? (
        <Alert kind="info">Todavía no has enviado ninguna aportación.</Alert>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Tipo</th><th>Contenido</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {aportaciones.map((a) => (
                <tr key={a.id}>
                  <td className="muted">{fmtDate(a.created_at)}</td>
                  <td><Badge tone="leido">{submissionTypeLabel(a.stype)}</Badge></td>
                  <td>
                    <strong>{a.title}</strong>
                    {a.body ? <><br /><span className="muted">{truncate(a.body, 220)}</span></> : null}
                  </td>
                  <td><Badge tone={statusTone(a.status)}>{STATUS_LABELS[a.status] ?? a.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function fmtDate(s: string): string {
  if (!s) return "—";
  const d = new Date(s.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
