import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Alert, Badge, Cards, Stat, statusTone } from "@/components/admin-ui";
import { requireAdmin } from "@/lib/admin-guard";
import { csrfToken, csrfVerify } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/admin";

/**
 * ============================================================================
 *  USUARIOS  ->  /admin/users  (antes admin/users.php)
 *  El administrador actual no puede cambiarse el rol ni desactivarse a si mismo.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const flashOk = typeof sp["ok"] === "string" ? sp["ok"] : "";
  const flashErr = typeof sp["err"] === "string" ? sp["err"] : "";
  const csrf = csrfToken();

  async function action(formData: FormData) {
    "use server";
    const admin = await requireAdmin();
    const data: Record<string, string> = {};
    formData.forEach((v, k) => (data[k] = typeof v === "string" ? v : ""));

    if (!csrfVerify(data["_csrf"])) {
      redirect(`/admin/users?err=${encodeURIComponent("Token de seguridad inválido.")}`);
    }
    const id = Number.parseInt(data["id"] ?? "0", 10);
    const doAct = data["do"] ?? "";
    const target = id > 0 ? await prisma.user.findUnique({ where: { id } }) : null;

    if (!target) {
      redirect(`/admin/users?err=${encodeURIComponent("Usuario no encontrado.")}`);
    }
    if (target.id === admin.id && ["ban", "role", "borrar"].includes(doAct)) {
      redirect(`/admin/users?err=${encodeURIComponent("No puedes cambiar tu propio acceso.")}`);
    }

    if (doAct === "activar") {
      await prisma.user.update({
        where: { id },
        data: { status: "active", emailVerifiedAt: target.emailVerifiedAt ?? new Date(), updatedAt: new Date() },
      });
      await audit("user_activated", { id });
      revalidatePath("/admin/users");
      redirect(`/admin/users?ok=${encodeURIComponent("Cuenta activada.")}`);
    }
    if (doAct === "ban") {
      await prisma.user.update({ where: { id }, data: { status: "banned", updatedAt: new Date() } });
      await prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await audit("user_banned", { id });
      revalidatePath("/admin/users");
      redirect(`/admin/users?ok=${encodeURIComponent("Cuenta desactivada.")}`);
    }
    if (doAct === "role") {
      const role = data["role"] ?? "user";
      if (["admin", "user"].includes(role)) {
        await prisma.user.update({ where: { id }, data: { role, updatedAt: new Date() } });
        await audit("user_role", { id, role });
        revalidatePath("/admin/users");
        redirect(`/admin/users?ok=${encodeURIComponent("Rol actualizado.")}`);
      }
    }
    if (doAct === "borrar") {
      await prisma.user.delete({ where: { id } });
      await audit("user_deleted", { id });
      revalidatePath("/admin/users");
      redirect(`/admin/users?ok=${encodeURIComponent("Usuario eliminado.")}`);
    }
    redirect(`/admin/users?err=${encodeURIComponent("Acción no válida.")}`);
  }

  const [total, activos, pendientes, admins, usuarios] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "active" } }),
    prisma.user.count({ where: { status: "pending" } }),
    prisma.user.count({ where: { role: "admin" } }),
    prisma.user.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
  ]);

  return (
    <>
      <h1>Usuarios</h1>
      {flashOk ? <Alert kind="ok">{flashOk}</Alert> : null}
      {flashErr ? <Alert kind="error">{flashErr}</Alert> : null}

      <Cards>
        <Stat num={total} label="Cuentas totales" />
        <Stat num={activos} label="Cuentas activas" />
        <Stat num={pendientes} label="Pendientes de verificar" />
        <Stat num={admins} label="Administradores" />
      </Cards>

      <h2>Listado de cuentas</h2>
      {usuarios.length === 0 ? (
        <Alert kind="info">Todavía no hay usuarios registrados.</Alert>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Alta</th><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const self = u.id === me.id;
                return (
                  <tr key={u.id}>
                    <td className="muted">{u.createdAt ? u.createdAt.toLocaleDateString("es-ES") : "—"}</td>
                    <td>{u.name || "—"}{self ? <span className="muted"> (tú)</span> : null}</td>
                    <td><a href={`mailto:${u.email}`}>{u.email}</a></td>
                    <td><Badge tone={u.role === "admin" ? "nuevo" : "leido"}>{u.role}</Badge></td>
                    <td><Badge tone={statusTone(u.status)}>{u.status}</Badge></td>
                    <td>
                      <div className="actions">
                        {u.status !== "active" ? (
                          <form method="post" className="inline" action={action}>
                            <input type="hidden" name="_csrf" value={csrf} />
                            <input type="hidden" name="id" value={u.id} />
                            <input type="hidden" name="do" value="activar" />
                            <button className="btn btn--ghost btn--sm" type="submit">Activar</button>
                          </form>
                        ) : null}

                        {!self ? (
                          <>
                            <form method="post" className="inline" action={action}>
                              <input type="hidden" name="_csrf" value={csrf} />
                              <input type="hidden" name="id" value={u.id} />
                              <input type="hidden" name="do" value="role" />
                              <input type="hidden" name="role" value={u.role === "admin" ? "user" : "admin"} />
                              <button className="btn btn--ghost btn--sm" type="submit">
                                {u.role === "admin" ? "Quitar admin" : "Hacer admin"}
                              </button>
                            </form>
                            {u.status !== "banned" ? (
                              <form method="post" className="inline" action={action}>
                                <input type="hidden" name="_csrf" value={csrf} />
                                <input type="hidden" name="id" value={u.id} />
                                <input type="hidden" name="do" value="ban" />
                                <button className="btn btn--ghost btn--sm" type="submit">Desactivar</button>
                              </form>
                            ) : null}
                            <form method="post" className="inline" action={action}>
                              <input type="hidden" name="_csrf" value={csrf} />
                              <input type="hidden" name="id" value={u.id} />
                              <input type="hidden" name="do" value="borrar" />
                              <button className="btn btn--danger btn--sm" type="submit">Borrar</button>
                            </form>
                          </>
                        ) : (
                          <span className="muted">Sesión actual</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
