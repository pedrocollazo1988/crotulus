import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Alert, Badge, Cards, Stat, statusTone } from "@/components/admin-ui";
import { requireAdmin } from "@/lib/admin-guard";
import { csrfToken, csrfVerify } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { submissionTypes, submissionTypeLabel, submissionsAutoApprove } from "@/lib/submissions";
import { setting } from "@/lib/settings";

/**
 * ============================================================================
 *  APORTACIONES  ->  /admin/submissions  (antes admin/submissions.php)
 *  El «peso» (0-5) solo aplica a las preguntas; alimenta el algoritmo de FAQ.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

const STATUSES = ["aprobada", "rechazada", "pendiente"];

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const flashOk = typeof sp["ok"] === "string" ? sp["ok"] : "";
  const flashErr = typeof sp["err"] === "string" ? sp["err"] : "";
  const typeFilter = typeof sp["type"] === "string" ? sp["type"] : "";
  const statusFilter = typeof sp["status"] === "string" ? sp["status"] : "";
  const csrf = csrfToken();
  const types = submissionTypes();

  async function action(formData: FormData) {
    "use server";
    await requireAdmin();
    const data: Record<string, string> = {};
    formData.forEach((v, k) => (data[k] = typeof v === "string" ? v : ""));
    if (!csrfVerify(data["_csrf"])) {
      redirect(`/admin/submissions?err=${encodeURIComponent("Token de seguridad inválido.")}`);
    }
    const id = Number.parseInt(data["id"] ?? "0", 10);
    const doAct = data["do"] ?? "";
    const score = Number.parseInt(data["score"] ?? "0", 10);

    if (id > 0 && STATUSES.includes(doAct)) {
      await prisma.userSubmission.update({ where: { id }, data: { status: doAct, updatedAt: new Date() } });
      if (doAct === "aprobada") {
        await prisma.userSubmission.update({
          where: { id },
          data: { score: Math.max(0, Math.min(5, Number.isNaN(score) ? 0 : score)) },
        });
      }
      revalidatePath("/admin/submissions");
      redirect(`/admin/submissions?ok=${encodeURIComponent("Aportación actualizada.")}`);
    }
    if (id > 0 && doAct === "borrar") {
      await prisma.userSubmission.delete({ where: { id } });
      revalidatePath("/admin/submissions");
      redirect(`/admin/submissions?ok=${encodeURIComponent("Aportación eliminada.")}`);
    }
    redirect(`/admin/submissions?err=${encodeURIComponent("Acción no válida.")}`);
  }

  const where: Record<string, unknown> = {};
  if (typeFilter && typeFilter in types) where.stype = typeFilter;
  if (statusFilter && STATUSES.includes(statusFilter)) where.status = statusFilter;

  const [items, cTestimonio, cPregunta, pend, autoApprove] = await Promise.all([
    prisma.userSubmission.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: 500,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.userSubmission.count({ where: { stype: "testimonio" } }),
    prisma.userSubmission.count({ where: { stype: "pregunta" } }),
    prisma.userSubmission.count({ where: { status: "pendiente" } }),
    setting("submissions_auto_approve", "0"),
  ]);

  const ordered = [...items].sort((a, b) => {
    const rank = (s: string) => (s === "pendiente" ? 0 : s === "aprobada" ? 1 : 2);
    const d = rank(a.status) - rank(b.status);
    return d !== 0 ? d : (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
  });

  return (
    <>
      <h1>Aportaciones de usuarios</h1>
      {flashOk ? <Alert kind="ok">{flashOk}</Alert> : null}
      {flashErr ? <Alert kind="error">{flashErr}</Alert> : null}

      <Cards>
        <Stat num={cTestimonio} label="Testimonios" />
        <Stat num={cPregunta} label="Preguntas" />
        <Stat num={pend} label="Pendientes" />
      </Cards>

      <p className="muted">
        Publicación automática: <strong>{autoApprove === "1" ? "activada" : "desactivada (se moderan)"}</strong>.{" "}
        El «peso» (0-5) solo se aplica a las preguntas y alimenta el algoritmo de importancia que elige las
        destacadas de la portada.
      </p>

      <div className="actions" style={{ marginBottom: "1rem" }}>
        <a className={`btn-link ${typeFilter === "" ? "is-active" : ""}`} href="/admin/submissions">Todas</a>
        {Object.entries(types).map(([key, label]) => (
          <a key={key} className={`btn-link ${typeFilter === key ? "is-active" : ""}`} href={`/admin/submissions?type=${key}`}>
            {label}
          </a>
        ))}
        <span className="muted">·</span>
        <a className={`btn-link ${statusFilter === "pendiente" ? "is-active" : ""}`} href="/admin/submissions?status=pendiente">Pendientes</a>
        <a className={`btn-link ${statusFilter === "aprobada" ? "is-active" : ""}`} href="/admin/submissions?status=aprobada">Aprobadas</a>
      </div>

      {ordered.length === 0 ? (
        <Alert kind="info">Todavía no hay aportaciones.</Alert>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Tipo</th><th>Usuario</th><th>Contenido</th><th>Estado</th><th>Peso</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {ordered.map((r) => (
                <tr key={r.id}>
                  <td className="muted">{fmtDate(r.createdAt)}</td>
                  <td><Badge tone="leido">{submissionTypeLabel(r.stype)}</Badge></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: ".55rem" }}>
                      {r.photoData ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/testimonial-photo/${r.id}`}
                          alt=""
                          width={34}
                          height={34}
                          style={{ borderRadius: "50%", objectFit: "cover", flex: "none", border: "1px solid var(--color-line)" }}
                        />
                      ) : null}
                      <span>
                        {r.user?.name || r.title || "—"}
                        <br />
                        <span className="muted">{r.user?.email ?? (r.userId ? "" : "visitante anónimo")}</span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <strong>{r.user ? r.title : r.authorRole || r.title}</strong>
                    <br />
                    <span className="muted">{truncate(r.body ?? "", 220)}</span>
                  </td>
                  <td><Badge tone={statusTone(r.status)}>{r.status}</Badge></td>
                  <td>{r.stype === "pregunta" ? `${r.score}/5` : "—"}</td>
                  <td>
                    <div className="actions">
                      {r.status !== "aprobada" ? (
                        <form method="post" className="inline" action={action}>
                          <input type="hidden" name="_csrf" value={csrf} />
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="do" value="aprobada" />
                          {r.stype === "pregunta" ? (
                            <input
                              type="text" name="score" defaultValue={r.score} inputMode="numeric"
                              title="Peso 0-5" style={{ width: "3.2rem" }} aria-label="Peso 0-5"
                            />
                          ) : null}
                          <button className="btn-link" type="submit">Aprobar</button>
                        </form>
                      ) : null}
                      {r.status !== "rechazada" ? (
                        <form method="post" className="inline" action={action}>
                          <input type="hidden" name="_csrf" value={csrf} />
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="do" value="rechazada" />
                          <button className="btn-link" type="submit">Rechazar</button>
                        </form>
                      ) : null}
                      <form method="post" className="inline" action={action}>
                        <input type="hidden" name="_csrf" value={csrf} />
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="do" value="borrar" />
                        <button className="btn-link" type="submit">Eliminar</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>¿Cómo se ordenan las preguntas?</h2>
      <p className="muted">
        La portada muestra las preguntas más relevantes según un algoritmo que combina el peso manual (0-5),
        cuántos usuarios formulan la misma pregunta, el origen verificado y la antigüedad. Los pesos se ajustan
        con las variables de entorno <code>FAQ_WEIGHT_*</code>.
      </p>
    </>
  );
}

function fmtDate(d: Date | null): string {
  return d ? d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "—";
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
