import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Alert } from "@/components/admin-ui";
import { requireAdmin } from "@/lib/admin-guard";
import { csrfToken, csrfVerify } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { limitText, cleanText } from "@/lib/validator";

/**
 * ============================================================================
 *  CONTENIDO  ->  /admin/content  (antes admin/content.php)
 *  Servicios, proyectos, testimonios, FAQ y proceso.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  servicio: "Servicios",
  proyecto: "Proyectos",
  testimonio: "Testimonios",
  faq: "Preguntas frecuentes",
  proceso: "Cómo trabajamos",
};

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const flashOk = typeof sp["ok"] === "string" ? sp["ok"] : "";
  const flashErr = typeof sp["err"] === "string" ? sp["err"] : "";
  const filter = typeof sp["type"] === "string" && sp["type"] in TYPES ? sp["type"] : "";
  const editId = Number.parseInt(typeof sp["edit"] === "string" ? sp["edit"] : "0", 10);
  const csrf = csrfToken();

  async function action(formData: FormData) {
    "use server";
    await requireAdmin();
    const data: Record<string, string> = {};
    formData.forEach((v, k) => (data[k] = typeof v === "string" ? v : ""));
    if (!csrfVerify(data["_csrf"])) {
      redirect(`/admin/content?err=${encodeURIComponent("Token de seguridad inválido.")}`);
    }
    const doAct = data["do"] ?? "";
    const id = Number.parseInt(data["id"] ?? "0", 10);

    if (doAct === "save") {
      const ctype = data["ctype"] ?? "";
      if (!(ctype in TYPES)) {
        redirect(`/admin/content?err=${encodeURIComponent("Tipo de contenido no válido.")}`);
      }
      const payload = {
        ctype,
        title: limitText(data["title"] ?? "", 200),
        subtitle: limitText(data["subtitle"] ?? "", 255),
        body: cleanText(data["body"] ?? ""),
        sortOrder: Number.parseInt(data["sort_order"] ?? "0", 10) || 0,
        score: Math.max(0, Math.min(5, Number.parseInt(data["score"] ?? "0", 10) || 0)),
        isActive: data["is_active"] !== undefined,
        updatedAt: new Date(),
      };
      if (id > 0) {
        await prisma.contentItem.update({ where: { id }, data: payload });
      } else {
        await prisma.contentItem.create({ data: { ...payload, createdAt: new Date() } });
      }
      revalidatePath("/admin/content");
      redirect(`/admin/content?ok=${encodeURIComponent("Contenido guardado.")}`);
    }
    if (id > 0 && doAct === "borrar") {
      await prisma.contentItem.delete({ where: { id } });
      revalidatePath("/admin/content");
      redirect(`/admin/content?ok=${encodeURIComponent("Elemento eliminado.")}`);
    }
    redirect(`/admin/content?err=${encodeURIComponent("Acción no válida.")}`);
  }

  const items = await prisma.contentItem.findMany({
    where: filter ? { ctype: filter } : {},
    orderBy: filter
      ? [{ sortOrder: "asc" }, { id: "asc" }]
      : [{ ctype: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  });
  const edit = editId > 0 ? await prisma.contentItem.findUnique({ where: { id: editId } }) : null;

  return (
    <>
      <h1>Contenido editable</h1>
      {flashOk ? <Alert kind="ok">{flashOk}</Alert> : null}
      {flashErr ? <Alert kind="error">{flashErr}</Alert> : null}

      <p className="muted">
        Estos elementos se sirven a la web mediante la API. Si no hay datos aquí, la web
        muestra su contenido por defecto.
      </p>

      <p>
        <a className="btn btn--ghost btn--sm" href="/admin/content">Todos</a>{" "}
        {Object.entries(TYPES).map(([key, label]) => (
          <a key={key} className="btn btn--ghost btn--sm" href={`/admin/content?type=${key}`}>{label}</a>
        ))}
      </p>

      <form method="post" action={action}>
        <h2>{edit ? `Editar elemento #${edit.id}` : "Añadir elemento"}</h2>
        <input type="hidden" name="_csrf" value={csrf} />
        <input type="hidden" name="do" value="save" />
        <input type="hidden" name="id" value={edit ? edit.id : 0} />

        <div className="grid-2">
          <div className="field">
            <label htmlFor="ctype">Tipo</label>
            <select id="ctype" name="ctype" required defaultValue={edit?.ctype ?? "servicio"}>
              {Object.entries(TYPES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sort_order">Orden</label>
            <input type="text" id="sort_order" name="sort_order" inputMode="numeric" defaultValue={edit?.sortOrder ?? 0} />
          </div>
          <div className="field">
            <label htmlFor="score">Importancia de la FAQ (0-5)</label>
            <input type="text" id="score" name="score" inputMode="numeric" defaultValue={edit?.score ?? 0} />
            <p className="muted">
              Peso manual para el algoritmo que elige las preguntas destacadas de la portada
              (solo se aplica a las preguntas frecuentes).
            </p>
          </div>
        </div>

        <div className="field">
          <label htmlFor="title">Título</label>
          <input type="text" id="title" name="title" defaultValue={edit?.title ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="subtitle">Subtítulo / resumen corto</label>
          <input type="text" id="subtitle" name="subtitle" defaultValue={edit?.subtitle ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="body">Descripción</label>
          <textarea id="body" name="body" rows={4} defaultValue={edit?.body ?? ""} />
        </div>
        <div className="field">
          <label>
            <input type="checkbox" name="is_active" value="1" defaultChecked={!edit || edit.isActive} /> Visible en la web
          </label>
        </div>

        <button className="btn" type="submit">Guardar</button>
        {edit ? <a className="btn btn--ghost" href="/admin/content">Cancelar</a> : null}
      </form>

      <h2>Elementos ({items.length})</h2>
      {items.length === 0 ? (
        <Alert kind="info">No hay elementos para este filtro.</Alert>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Tipo</th><th>Título</th><th>Orden</th><th>Importancia</th><th>Activo</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>{it.id}</td>
                  <td>{TYPES[it.ctype] ?? it.ctype}</td>
                  <td>
                    {it.title}
                    <br />
                    <span className="muted">{truncate(it.subtitle ?? "", 90)}</span>
                  </td>
                  <td>{it.sortOrder}</td>
                  <td>{it.ctype === "faq" ? `${it.score}/5` : "—"}</td>
                  <td>{it.isActive ? "Sí" : "No"}</td>
                  <td>
                    <div className="actions">
                      <a className="btn btn--ghost btn--sm" href={`/admin/content?edit=${it.id}`}>Editar</a>
                      <form method="post" className="inline" action={action}>
                        <input type="hidden" name="_csrf" value={csrf} />
                        <input type="hidden" name="id" value={it.id} />
                        <input type="hidden" name="do" value="borrar" />
                        <button className="btn btn--danger btn--sm" type="submit">Borrar</button>
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

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
