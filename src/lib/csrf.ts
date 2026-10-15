import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getConfig } from "./config";
import { jsonError } from "./http";

/**
 * ============================================================================
 *  CSRF (puerto de app/lib/security.php)
 * ----------------------------------------------------------------------------
 *  El backend PHP guardaba el token en $_SESSION. En serverless no hay estado
 *  de sesion en el proceso, asi que el token es AUTOCONTENIDO y FIRMADO:
 *      token = "<timestamp>.<hmac_sha256(appKey, 'csrf|<timestamp>')>"
 *  El navegador lo pide a ?action=csrf y lo devuelve en el campo _csrf o en la
 *  cabecera X-CSRF-Token. Un tercero no puede leerlo (same-origin) ni forjarlo
 *  (no conoce appKey), asi que protege igual que el token en sesion.
 * ============================================================================
 */

const CSRF_TTL_SECONDS = 60 * 60 * 24; // 24 h

function sign(payload: string): string {
  return createHmac("sha256", getConfig().security.appKey + "|csrf").update(payload).digest("hex");
}

/** Genera un token CSRF nuevo (autocontenido y firmado). */
export function csrfToken(): string {
  const ts = Math.floor(Date.now() / 1000);
  return `${ts}.${sign(String(ts))}`;
}

/** Valida un token CSRF. */
export function csrfVerify(token: string | null | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [ts, mac] = parts;
  if (!/^\d+$/.test(ts)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(ts)) > CSRF_TTL_SECONDS) return false;

  const expected = sign(ts);
  const a = Buffer.from(expected);
  const b = Buffer.from(mac);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Exige un CSRF valido (cabecera X-CSRF-Token o campo _csrf).
 * Devuelve una Response de error si no lo es; undefined si todo va bien.
 */
export function csrfRequire(req: Request, data: Record<string, unknown>): Response | undefined {
  const header = req.headers.get("x-csrf-token");
  const field = typeof data["_csrf"] === "string" ? (data["_csrf"] as string) : null;
  if (!csrfVerify(header ?? field)) {
    return jsonError("Token de seguridad invalido o caducado. Recarga la pagina.", 419);
  }
  return undefined;
}
