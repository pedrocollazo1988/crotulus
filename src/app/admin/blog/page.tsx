import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Alert } from "@/components/admin-ui";
import { requireAdmin } from "@/lib/admin-guard";
import { csrfToken, csrfVerify } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { limitText, cleanText } from "@/lib/validator";

/**
 * ============================================================================
 *  BLOG  ->  /admin/blog  (antes admin/blog.php)
 * ============================================================================
 */
export const dynamic = "force-dynamic";

/** Convierte un titulo en slug ASCII: "Cómo la IA" -> "como-la-ia". */
function slugify(text: string): string {
  const map: Record<string, string> = {
    "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u", "ü": "u", "ñ": "n",
    "à": "a", "è": "e", "ì": "i", "ò": "o", "ù": "u", "ç": "c",
  };
  return text
    .toLowerCase()
    .trim()
    .replace(/[áéíóúüñàèìòùç]/g, (c) => map[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function BlogAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const flashOk = typeof sp["ok"] === "string" ? sp["ok"] : "";
  const flashErr = typeof sp["err"] === "string" ? sp["err"] : "";
  const editId = Number.parseInt(typeof sp["edit"] === "string" ? sp["edit"] : "0", 10);
  const csrf = csrfToken();

  async function action(formData: FormData) {
    "use server";
    await requireAdmin();
    const data: Record<string, string> = {};
    formData.forEach((v, k) => (data[k] = typeof v === "string" ? v : ""));
    if (!csrfVerify(data["_csrf"])) {
      redirect(`/admin/blog?err=${encodeURIComponent("Token de seguridad inválido.")}`);
    }
    const doAct = data["do"] ?? "";
    const id = Number.parseInt(data["id"] ?? "0", 10);

    if (doAct === "save") {
      const title = limitText(data["title"] ?? "", 200);
      let slug = slugify(data["slug"] ?? "");
      if (slug === "") slug = slugify(title);
      const payload = {
        slug,
        title,
        excerpt: cleanText(data["excerpt"] ?? ""),
        body: cleanText(data["body"] ?? ""),
        category: limitText(data["category"] ?? "", 80),
        author: limitText(data["author"] ?? "", 200),
        image: limitText(data["image"] ?? "", 255),
        meta: { reading_minutes: Math.max(0, Math.min(60, Number.parseInt(data["reading_minutes"] ?? "0", 10) || 0)) },
        sortOrder: Number.parseInt(data["sort_order"] ?? "0", 10) || 0,
        isActive: data["is_active"] !== undefined,
        updatedAt: new Date(),
      };
      if (id > 0) {
        await prisma.blogPost.update({ where: { id }, data: payload });
      } else {
        await prisma.blogPost.create({ data: { ...payload, createdAt: new Date(), publishedAt: new Date() } });
      }
      revalidatePath("/admin/blog");
      redirect(`/admin/blog?ok=${encodeURIComponent("Artículo guardado.")}`);
    }
    if (id > 0 && doAct === "borrar") {
      await prisma.blogPost.delete({ where: { id } });
      revalidatePath("/admin/blog");
      redirect(`/admin/blog?ok=${encodeURIComponent("Artículo eliminado.")}`);
    }
    if (id > 0 && (doAct === "publicar" || doAct === "ocultar")) {
      await prisma.blogPost.update({ where: { id }, data: { isActive: doAct === "publicar", updatedAt: new Date() } });
      revalidatePath("/admin/blog");
      redirect(`/admin/blog?ok=${encodeURIComponent(doAct === "publicar" ? "Artículo publicado." : "Artículo oculto.")}`);
    }
    redirect(`/admin/blog?err=${encodeURIComponent("Acción no válida.")}`);
  }

  const items = await prisma.blogPost.findMany({
    orderBy: [{ publishedAt: "desc" }, { sortOrder: "asc" }, { id: "desc" }],
  });
  const edit = editId > 0 ? await prisma.blogPost.findUnique({ where: { id: editId } }) : null;
  const editMeta = (edit?.meta as Record<string, unknown> | null) ?? {};

  return (
    <>
      <h1>Blog</h1>
      {flashOk ? <Alert kind="ok">{flashOk}</Alert> : null}
      {flashErr ? <Alert kind="error">{flashErr}</Alert> : null}

      <p className="muted">
        Los artículos publicados aparecen en la sección «Blog» de la web. La portada es una
        ruta a una imagen (por ejemplo <code>assets/img/blog/mi-articulo.svg</code>).
      </p>

      <form method="post" action={action}>
        <h2>{edit ? `Editar artículo #${edit.id}` : "Añadir artículo"}</h2>
        <input type="hidden" name="_csrf" value={csrf} />
        <input type="hidden" name="do" value="save" />
        <input type="hidden" name="id" value={edit ? edit.id : 0} />

        <div className="grid-2">
          <div className="field">
            <label htmlFor="title">Título</label>
            <input type="text" id="title" name="title" defaultValue={edit?.title ?? ""} required />
          </div>
          <div className="field">
            <label htmlFor="slug">Slug (URL)</label>
            <input type="text" id="slug" name="slug" defaultValue={edit?.slug ?? ""} placeholder="se-genera-del-titulo" />
          </div>
          <div className="field">
            <label htmlFor="category">Categoría</label>
            <input type="text" id="category" name="category" defaultValue={edit?.category ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="author">Autor</label>
            <input type="text" id="author" name="author" defaultValue={edit?.author ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="image">Imagen de portada (ruta)</label>
            <input type="text" id="image" name="image" defaultValue={edit?.image ?? ""} placeholder="assets/img/blog/..." />
          </div>
          <div className="field">
            <label htmlFor="sort_order">Orden</label>
            <input type="text" id="sort_order" name="sort_order" inputMode="numeric" defaultValue={edit?.sortOrder ?? 0} />
          </div>
          <div className="field">
            <label htmlFor="reading_minutes">Minutos de lectura</label>
            <input
              type="text" id="reading_minutes" name="reading_minutes" inputMode="numeric"
              defaultValue={String(editMeta["reading_minutes"] ?? 4)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="excerpt">Extracto / resumen</label>
          <textarea id="excerpt" name="excerpt" rows={2} defaultValue={edit?.excerpt ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="body">Contenido</label>
          <textarea id="body" name="body" rows={8} defaultValue={edit?.body ?? ""} />
        </div>
        <div className="field">
          <label>
            <input type="checkbox" name="is_active" value="1" defaultChecked={!edit || edit.isActive} /> Publicado
          </label>
        </div>

        <button className="btn" type="submit">Guardar</button>
        {edit ? <a className="btn btn--ghost" href="/admin/blog">Cancelar</a> : null}
      </form>

      <h2>Artículos ({items.length})</h2>
      {items.length === 0 ? (
        <Alert kind="info">Todavía no hay artículos.</Alert>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Título</th><th>Categoría</th><th>Publicado</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>{it.id}</td>
                  <td>
                    {it.title}
                    <br />
                    <span className="muted">{truncate(it.excerpt ?? "", 90)}</span>
                  </td>
                  <td>{it.category}</td>
                  <td>{it.publishedAt ? it.publishedAt.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                  <td>{it.isActive ? "Publicado" : "Oculto"}</td>
                  <td>
                    <div className="actions">
                      <a className="btn btn--ghost btn--sm" href={`/admin/blog?edit=${it.id}`}>Editar</a>
                      <form method="post" className="inline" action={action}>
                        <input type="hidden" name="_csrf" value={csrf} />
                        <input type="hidden" name="id" value={it.id} />
                        <input type="hidden" name="do" value={it.isActive ? "ocultar" : "publicar"} />
                        <button className="btn btn--ghost btn--sm" type="submit">{it.isActive ? "Ocultar" : "Publicar"}</button>
                      </form>
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
