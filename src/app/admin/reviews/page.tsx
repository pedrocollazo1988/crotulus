import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Alert, Badge, Cards, Stat, statusTone } from "@/components/admin-ui";
import { requireAdmin } from "@/lib/admin-guard";
import { csrfToken, csrfVerify } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { reviewsSummary } from "@/lib/reviews";
import { setting, settingSet } from "@/lib/settings";
import { audit } from "@/lib/admin";

/**
 * ============================================================================
 *  VALORACIONES  ->  /admin/reviews  (antes admin/reviews.php)
 * ============================================================================
 */
export const dynamic = "force-dynamic";

const STATUSES = ["aprobada", "rechazada", "pendiente"];

/** Interruptores de visibilidad de los bloques de valoraciones de la portada. */
const SECTIONS = [
  { key: "testimonials_enabled", label: "Testimonios de clientes", hint: "Carrusel «Lo que opinan nuestros clientes»." },
  { key: "google_reviews_enabled", label: "Opiniones de Google", hint: "Reseñas de tu ficha de Google." },
  { key: "trustpilot_enabled", label: "Reseñas de Trustpilot", hint: "Reseñas verificadas de Trustpilot." },
] as const;

/** Interruptor del formulario publico de testimonios (abierto, sin cuenta). */
const FORM_TOGGLE = {
  key: "testimonials_form_enabled",
  label: "Formulario para dejar testimonio",
  hint: "Cualquier visitante puede enviar su testimonio desde la portada, sin crear cuenta.",
} as const;

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

  /** Server Action: guarda qué bloques de valoraciones se ven en la portada. */
  async function saveSections(formData: FormData) {
    "use server";
    await requireAdmin();
    const data: Record<string, string> = {};
    formData.forEach((v, k) => (data[k] = typeof v === "string" ? v : ""));
    if (!csrfVerify(data["_csrf"])) {
      redirect(`/admin/reviews?err=${encodeURIComponent("Token de seguridad inválido.")}`);
    }
    for (const { key } of SECTIONS) {
      await settingSet(key, data[key] !== undefined ? "1" : "0");
    }
    await settingSet(FORM_TOGGLE.key, data[FORM_TOGGLE.key] !== undefined ? "1" : "0");
    await audit("reviews_sections_updated");
    revalidatePath("/admin/reviews");
    revalidatePath("/");
    redirect(`/admin/reviews?ok=${encodeURIComponent("Visibilidad de las secciones guardada.")}`);
  }

  const where = statusFilter && STATUSES.includes(statusFilter) ? { status: statusFilter } : {};
  const [items, total, pend, appr, avg, autoApprove, sectionsState, formToggleOn] = await Promise.all([
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
    Promise.all(SECTIONS.map(async ({ key }) => ({ key, on: (await setting(key, "1")) === "1" }))),
    setting(FORM_TOGGLE.key, "1"),
  ]);
  const sections = sectionsState as { key: string; on: boolean }[];

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

      <form method="post" action={saveSections}>
        <input type="hidden" name="_csrf" value={csrf} />
        <div className="settings-card">
          <h2>Secciones visibles en la página principal</h2>
          <p className="muted">
            Activa o desactiva cada bloque de forma independiente. Lo que desmarques
            deja de mostrarse en la portada (también desaparece del menú de navegación).
          </p>
          <div className="grid-2">
            {SECTIONS.map(({ key, label, hint }) => {
              const on = sections.find((s) => s.key === key)?.on ?? true;
              return (
                <div className="field" key={key}>
                  <label>
                    <input type="checkbox" name={key} value="1" defaultChecked={on} /> {label}
                  </label>
                  <p className="field__hint">{hint}</p>
                </div>
              );
            })}
          </div>
          <div className="field">
            <label>
              <input type="checkbox" name={FORM_TOGGLE.key} value="1" defaultChecked={formToggleOn === "1"} />{" "}
              {FORM_TOGGLE.label}
            </label>
            <p className="field__hint">{FORM_TOGGLE.hint}</p>
          </div>
          <button className="btn" type="submit">Guardar visibilidad</button>
        </div>
      </form>

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
