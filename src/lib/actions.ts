import "server-only";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { bootstrap } from "./bootstrap";
import { csrfRequire } from "./csrf";
import { jsonError } from "./http";

/**
 * ============================================================================
 *  SERVER ACTIONS DEL PANEL
 * ----------------------------------------------------------------------------
 *  Las paginas del panel usan formularios clasicos (POST) resueltos con Server
 *  Actions. Cada accion valida el CSRF igual que hacia el backend PHP y
 *  revalida la ruta para refrescar la tabla.
 * ============================================================================
 */

/** Lee el FormData como objeto plano y exige un CSRF valido. */
export async function readForm(formData: FormData): Promise<{
  data: Record<string, string>;
  csrfOk: boolean;
}> {
  await bootstrap();
  const data: Record<string, string> = {};
  formData.forEach((value, key) => {
    data[key] = typeof value === "string" ? value : "";
  });
  const check = csrfRequire(new Request("http://local/", { method: "POST" }), data);
  return { data, csrfOk: check === undefined };
}

/** Redirige con un aviso en la URL (?ok= / ?err=). */
export function redirectWith(path: string, kind: "ok" | "err", message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(message)}`);
}

/** Lee los avisos de los parametros de busqueda. */
export function readFlash(sp: Record<string, string | string[] | undefined>) {
  const ok = typeof sp["ok"] === "string" ? sp["ok"] : "";
  const err = typeof sp["err"] === "string" ? sp["err"] : "";
  return { ok, err };
}

export { jsonError, revalidatePath };
