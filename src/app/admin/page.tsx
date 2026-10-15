import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Alert, Badge, Cards, Stat, statusTone } from "@/components/admin-ui";
import { requireAdmin } from "@/lib/admin-guard";
import { csrfToken, csrfVerify } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";

/**
 * ============================================================================
 *  BANDEJA DE MENSAJES  ->  /admin  (antes admin/index.php)
 * ============================================================================
 */
export const dynamic = "force-dynamic";

const STATUS_MAP: Record<string, string> = {
  no_leido: "nuevo",
  leido: "leido",
  archivado: "archivado",
};

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const flashOk = typeof sp["ok"] === "string" ? sp["ok"] : "";
  const flashErr = typeof sp["err"] === "string" ? sp["err"] : "";
  const csrf = csrfToken();

  async function action(formData: FormData) {
    "use server";
    await requireAdmin();
    const data: Record<string, string> = {};
    formData.forEach((v, k) => (data[k] = typeof v === "string" ? v : ""));

    if (!csrfVerify(data["_csrf"])) {
      redirect(`/admin?err=${encodeURIComponent("Token de seguridad inválido.")}`);
    }
    const id = Number.parseInt(data["id"] ?? "0", 10);
    const action = data["do"] ?? "";
    if (id > 0 && STATUS_MAP[action]) {
      await prisma.contactMessage.update({ where: { id }, data: { status: STATUS_MAP[action] } });
      revalidatePath("/admin");
      redirect(`/admin?ok=${encodeURIComponent("Mensaje actualizado.")}`);
    }
    if (id > 0 && action === "borrar") {
      await prisma.contactMessage.delete({ where: { id } });
      revalidatePath("/admin");
      redirect(`/admin?ok=${encodeURIComponent("Mensaje eliminado.")}`);
    }
    redirect(`/admin?err=${encodeURIComponent("Acción no válida.")}`);
  }

  const [total, nuevos, usuarios, mensajes] = await Promise.all([
    prisma.contactMessage.count(),
    prisma.contactMessage.count({ where: { status: "nuevo" } }),
    prisma.user.count(),
    prisma.contactMessage.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 200 }),
  ]);

  return (
    <>
      <h1>Mensajes de contacto</h1>
      {flashOk ? <Alert kind="ok">{flashOk}</Alert> : null}
      {flashErr ? <Alert kind="error">{flashErr}</Alert> : null}

      <Cards>
        <Stat num={nuevos} label="Mensajes nuevos" />
        <Stat num={total} label="Mensajes totales" />
        <Stat num={usuarios} label="Usuarios registrados" />
        <Stat num={getConfig().db.driver} label="Base de datos" />
      </Cards>

      <h2>Bandeja de entrada</h2>
      {mensajes.length === 0 ? (
        <Alert kind="info">Todavía no hay mensajes.</Alert>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th><th>Nombre</th><th>Contacto</th><th>Servicio</th>
                <th>Mensaje</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {mensajes.map((m) => (
                <tr key={m.id}>
                  <td className="muted">{fmtDate(m.createdAt)}</td>
                  <td>{m.name}</td>
                  <td>
                    <a href={`mailto:${m.email}`}>{m.email}</a>
                    <br />
                    <span className="muted">{m.phone}</span>
                  </td>
                  <td>{m.service}</td>
                  <td>{truncate(m.message, 300)}</td>
                  <td><Badge tone={statusTone(m.status)}>{m.status}</Badge></td>
                  <td>
                    <div className="actions">
                      <form method="post" className="inline" action={action}>
                        <input type="hidden" name="_csrf" value={csrf} />
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="do" value="leido" />
                        <button className="btn btn--ghost btn--sm" type="submit">Leído</button>
                      </form>
                      <form method="post" className="inline" action={action}>
                        <input type="hidden" name="_csrf" value={csrf} />
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="do" value="archivado" />
                        <button className="btn btn--ghost btn--sm" type="submit">Archivar</button>
                      </form>
                      <form method="post" className="inline" action={action}>
                        <input type="hidden" name="_csrf" value={csrf} />
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="do" value="no_leido" />
                        <button className="btn btn--ghost btn--sm" type="submit">Nuevo</button>
                      </form>
                      <form method="post" className="inline" action={action}>
                        <input type="hidden" name="_csrf" value={csrf} />
                        <input type="hidden" name="id" value={m.id} />
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

function fmtDate(d: Date | null): string {
  return d ? d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "—";
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
