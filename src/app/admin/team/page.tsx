import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Alert } from "@/components/admin-ui";
import { requireAdmin } from "@/lib/admin-guard";
import { csrfToken, csrfVerify } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { limitText, cleanText } from "@/lib/validator";

/**
 * ============================================================================
 *  EQUIPO  ->  /admin/team  (antes admin/team.php)
 * ============================================================================
 */
export const dynamic = "force-dynamic";

export default async function TeamAdminPage({
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
      redirect(`/admin/team?err=${encodeURIComponent("Token de seguridad inválido.")}`);
    }
    const doAct = data["do"] ?? "";
    const id = Number.parseInt(data["id"] ?? "0", 10);

    if (doAct === "save") {
      const payload = {
        name: limitText(data["name"] ?? "", 200),
        role: limitText(data["role"] ?? "", 200),
        bio: cleanText(data["bio"] ?? ""),
        email: limitText(data["email"] ?? "", 200),
        phone: limitText(data["phone"] ?? "", 40),
        avatar: limitText(data["avatar"] ?? "", 255),
        meta: { linkedin: limitText(data["linkedin"] ?? "", 255) },
        sortOrder: Number.parseInt(data["sort_order"] ?? "0", 10) || 0,
        isActive: data["is_active"] !== undefined,
        updatedAt: new Date(),
      };
      if (id > 0) {
        await prisma.teamMember.update({ where: { id }, data: payload });
      } else {
        await prisma.teamMember.create({ data: { ...payload, createdAt: new Date() } });
      }
      revalidatePath("/admin/team");
      redirect(`/admin/team?ok=${encodeURIComponent("Miembro guardado.")}`);
    }
    if (id > 0 && doAct === "borrar") {
      await prisma.teamMember.delete({ where: { id } });
      revalidatePath("/admin/team");
      redirect(`/admin/team?ok=${encodeURIComponent("Miembro eliminado.")}`);
    }
    if (id > 0 && (doAct === "mostrar" || doAct === "ocultar")) {
      await prisma.teamMember.update({ where: { id }, data: { isActive: doAct === "mostrar", updatedAt: new Date() } });
      revalidatePath("/admin/team");
      redirect(`/admin/team?ok=${encodeURIComponent(doAct === "mostrar" ? "Miembro visible." : "Miembro oculto.")}`);
    }
    redirect(`/admin/team?err=${encodeURIComponent("Acción no válida.")}`);
  }

  const items = await prisma.teamMember.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  const edit = editId > 0 ? await prisma.teamMember.findUnique({ where: { id: editId } }) : null;
  const editMeta = (edit?.meta as Record<string, unknown> | null) ?? {};

  return (
    <>
      <h1>Equipo</h1>
      {flashOk ? <Alert kind="ok">{flashOk}</Alert> : null}
      {flashErr ? <Alert kind="error">{flashErr}</Alert> : null}

      <p className="muted">
        Las personas visibles aparecen en la sección «Equipo» de la web. El avatar es una
        ruta a una imagen (por ejemplo <code>assets/img/equipo/nombre.svg</code>).
      </p>

      <form method="post" action={action}>
        <h2>{edit ? `Editar miembro #${edit.id}` : "Añadir miembro"}</h2>
        <input type="hidden" name="_csrf" value={csrf} />
        <input type="hidden" name="do" value="save" />
        <input type="hidden" name="id" value={edit ? edit.id : 0} />

        <div className="grid-2">
          <div className="field">
            <label htmlFor="name">Nombre</label>
            <input type="text" id="name" name="name" defaultValue={edit?.name ?? ""} required />
          </div>
          <div className="field">
            <label htmlFor="role">Cargo</label>
            <input type="text" id="role" name="role" defaultValue={edit?.role ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="email">Correo</label>
            <input type="email" id="email" name="email" defaultValue={edit?.email ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="phone">Teléfono</label>
            <input type="tel" id="phone" name="phone" defaultValue={edit?.phone ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="avatar">Avatar (ruta)</label>
            <input type="text" id="avatar" name="avatar" defaultValue={edit?.avatar ?? ""} placeholder="assets/img/equipo/..." />
          </div>
          <div className="field">
            <label htmlFor="linkedin">LinkedIn (URL)</label>
            <input type="url" id="linkedin" name="linkedin" defaultValue={String(editMeta["linkedin"] ?? "")} />
          </div>
          <div className="field">
            <label htmlFor="sort_order">Orden</label>
            <input type="text" id="sort_order" name="sort_order" inputMode="numeric" defaultValue={edit?.sortOrder ?? 0} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="bio">Biografía corta</label>
          <textarea id="bio" name="bio" rows={3} defaultValue={edit?.bio ?? ""} />
        </div>
        <div className="field">
          <label>
            <input type="checkbox" name="is_active" value="1" defaultChecked={!edit || edit.isActive} /> Visible en la web
          </label>
        </div>

        <button className="btn" type="submit">Guardar</button>
        {edit ? <a className="btn btn--ghost" href="/admin/team">Cancelar</a> : null}
      </form>

      <h2>Miembros ({items.length})</h2>
      {items.length === 0 ? (
        <Alert kind="info">Todavía no hay miembros.</Alert>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Nombre</th><th>Cargo</th><th>Orden</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>{it.id}</td>
                  <td>{it.name}</td>
                  <td>{it.role}</td>
                  <td>{it.sortOrder}</td>
                  <td>{it.isActive ? "Visible" : "Oculto"}</td>
                  <td>
                    <div className="actions">
                      <a className="btn btn--ghost btn--sm" href={`/admin/team?edit=${it.id}`}>Editar</a>
                      <form method="post" className="inline" action={action}>
                        <input type="hidden" name="_csrf" value={csrf} />
                        <input type="hidden" name="id" value={it.id} />
                        <input type="hidden" name="do" value={it.isActive ? "ocultar" : "mostrar"} />
                        <button className="btn btn--ghost btn--sm" type="submit">{it.isActive ? "Ocultar" : "Mostrar"}</button>
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
