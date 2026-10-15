import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Alert, Badge, Cards, Stat, statusTone } from "@/components/admin-ui";
import { requireAdmin } from "@/lib/admin-guard";
import { csrfToken, csrfVerify } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { reviewsSummary } from "@/lib/reviews";
import { setting } from "@/lib/settings";

/**
 * ============================================================================
 *  VALORACIONES  ->  /admin/reviews  (antes admin/reviews.php)
 * ============================================================================
 */
export const dynamic = "force-dynamic";

const STATUSES = ["aprobada", "rechazada", "pendiente"];

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const flashOk = typeof sp["ok"] === "string" ? sp["ok"] : "";
  const flashErr = typeof sp["err"] === "string" ? sp["err"] : "";
  const statusFilter = typeof sp["status"] === "string" ? sp["status"] : "";
  const csrf = csrfToken();

  async function action(formData: FormData) {
    "use server";
    await requireAdmin();
    const data: Record<string, string> = {};
    formData.forEach((v, k) => (data[k] = typeof v === "string" ? v : ""));
    if (!csrfVerify(data["_csrf"])) {
      redirect(`/admin/reviews?err=${encodeURIComponent("Token de seguridad inválido.")}`);
    }
    const id = Number.parseInt(data["id"] ?? "0", 10);
    const doAct = data["do"] ?? "";
    if (id > 0 && STATUSES.includes(doAct)) {
      await prisma.review.update({ where: { id }, data: { status: doAct } });
      revalidatePath("/admin/reviews");
      redirect(`/admin/reviews?ok=${encodeURIComponent("Valoración actualizada.")}`);
    }
    if (id > 0 && doAct === "borrar") {
      await prisma.review.delete({ where: { id } });
      revalidatePath("/admin/reviews");
      redirect(`/admin/reviews?ok=${encodeURIComponent("Valoración eliminada.")}`);
    }
    redirect(`/admin/reviews?err=${encodeURIComponent("Acción no válida.")}`);
  }

  const where = statusFilter && STATUSES.includes(statusFilter) ? { status: statusFilter } : {};
  const [items, total, pend, appr, avg, autoApprove] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 500,
    }),
    prisma.review.count(),
    prisma.review.count({ where: { status: "pendiente" } }),
    prisma.review.count({ where: { status: "aprobada" } }),
    reviewsSummary(),
    setting("reviews_auto_approve", "0"),
  ]);

  return (
    <>
      <h1>Valoraciones de servicios y proyectos</h1>
      {flashOk ? <Alert kind="ok">{flashOk}</Alert> : null}
      {flashErr ? <Alert kind="error">{flashErr}</Alert> : null}

      <Cards>
        <Stat num={pend} label="Pendientes" />
        <Stat num={appr} label="Aprobadas" />
        <Stat num={total} label="Total recibidas" />
        <Stat num={avg.average.toFixed(1)} label="Media (aprobadas)" />
      </Cards>

      <p className="muted">
        Publicación automática: <strong>{autoApprove === "1" ? "activada" : "desactivada (se moderan)"}</strong>.{" "}
        {autoApprove !== "1" ? "Aprueba cada valoración para que aparezca en la web." : null}
      </p>

      <div className="actions" style={{ marginBottom: "1rem" }}>
        <a className={`btn-link ${statusFilter === "" ? "is-active" : ""}`} href="/admin/reviews">Todas</a>
        <a className={`btn-link ${statusFilter === "pendiente" ? "is-active" : ""}`} href="/admin/reviews?status=pendiente">Pendientes</a>
        <a className={`btn-link ${statusFilter === "aprobada" ? "is-active" : ""}`} href="/admin/reviews?status=aprobada">Aprobadas</a>
        <a className={`btn-link ${statusFilter === "rechazada" ? "is-active" : ""}`} href="/admin/reviews?status=rechazada">Rechazadas</a>
      </div>

      {items.length === 0 ? (
        <Alert kind="info">Todavía no hay valoraciones.</Alert>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th><th>Destino</th><th>Puntuación</th><th>Autor</th>
                <th>Comentario</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td className="muted">{fmtDate(r.createdAt)}</td>
                  <td>
                    <Badge tone="leido">{r.targetType}</Badge>
                    <br />
                    <span className="muted">{r.targetLabel || "—"}</span>
                  </td>
                  <td>
                    <strong>{r.rating}</strong>/5{" "}
                    <span className="muted" aria-hidden="true">{"★".repeat(r.rating)}</span>
                  </td>
                  <td>{r.authorName}<br /><span className="muted">{r.authorEmail}</span></td>
                  <td>{truncate(r.comment ?? "", 400)}</td>
                  <td><Badge tone={statusTone(r.status)}>{r.status}</Badge></td>
                  <td>
                    <div className="actions">
                      {r.status !== "aprobada" ? (
                        <form method="post" className="inline" action={action}>
                          <input type="hidden" name="_csrf" value={csrf} />
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="do" value="aprobada" />
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
    </>
  );
}

function fmtDate(d: Date | null): string {
  return d ? d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "—";
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
