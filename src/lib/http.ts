import "server-only";
import { NextResponse } from "next/server";
import { getConfig } from "./config";
import { appendFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * ============================================================================
 *  UTILIDADES GENERALES  (puerto de app/lib/helpers.php)
 *  Respuestas JSON uniformes, lectura de entradas, IP del visitante, logs y
 *  construccion de URLs publicas.
 * ============================================================================
 */

export type Json = Record<string, unknown>;

/** Respuesta JSON uniforme. */
export function jsonResponse(payload: Json, status = 200): NextResponse {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Respuesta de exito: { ok: true, ...datos }. */
export function jsonOk(data: Json = {}): NextResponse {
  return jsonResponse({ ok: true, ...data });
}

/** Respuesta de error: { ok: false, error, detalle? }. */
export function jsonError(
  error: string,
  status = 400,
  extra: Json = {},
): NextResponse {
  return jsonResponse({ ok: false, error, ...extra }, status);
}

/**
 * Datos de la peticion unificados (JSON o formulario), igual que
 * request_input() en PHP. Acepta un Request y devuelve un objeto plano.
 */
export async function requestInput(req: Request): Promise<Json> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const json = await req.json();
      return json && typeof json === "object" && !Array.isArray(json) ? json : {};
    } catch {
      return {};
    }
  }
  // Formulario (application/x-www-form-urlencoded o multipart).
  try {
    const form = await req.formData();
    const out: Json = {};
    for (const [k, v] of form.entries()) {
      out[k] = typeof v === "string" ? v : "";
    }
    return out;
  } catch {
    return {};
  }
}

/** Devuelve un valor de entrada recortado. */
export function input(data: Json, key: string, fallback = ""): string {
  const val = data[key];
  if (val === undefined || val === null || typeof val === "object") return fallback;
  return String(val).trim();
}

/** IP del visitante (respeta X-Forwarded-For si el proxy es de confianza). */
export function clientIp(req: Request): string {
  const cfg = getConfig();
  const trusted = cfg.security.trustedProxies;
  const remote =
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "0.0.0.0";

  // En Vercel (y cualquier PaaS) el proxy no es configurable, asi que usamos
  // la primera IP de X-Forwarded-For como valor de trabajo. Si hay proxies
  // declarados en config, solo confiamos en la cabecera para esos.
  const candidate = trusted.length ? remote : req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? remote;
  return /^[0-9a-fA-F:.]+$/.test(candidate) ? candidate : "0.0.0.0";
}

/** User agent recortado a 255 caracteres. */
export function userAgent(req: Request): string {
  return (req.headers.get("user-agent") ?? "").slice(0, 255);
}

/** Registro de la aplicacion. En serverless el disco es de solo lectura: falla en silencio. */
export async function appLog(message: string): Promise<void> {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  if (process.env.NODE_ENV !== "production") {
    // En desarrollo, a consola (mas comodo).
    console.warn("[crotulus]", message);
  }
  try {
    const dir = logDir();
    await mkdir(dir, { recursive: true });
    await appendFile(path.join(dir, "app.log"), line);
  } catch {
    // Sin disco escribible (Vercel): ignoramos.
  }
}

/** Carpeta de registros (app/data en desarrollo; /tmp en serverless). */
export function logDir(): string {
  const cfg = getConfig();
  if (cfg.paths.logDir) return cfg.paths.logDir;
  if (process.env.VERCEL) return tmpdir();
  return path.join(process.cwd(), "app-data");
}

/** URL publica del sitio (sin barra final). */
export function siteBaseUrl(): string {
  const configured = getConfig().siteUrl;
  if (configured) return configured.replace(/\/+$/, "");
  return "";
}

/**
 * Origen publico de la peticion, tal como lo ve el navegador. Detras de un
 * proxy/CDN (Vercel, el runtime de desarrollo) `req.url` apunta al host interno
 * (p. ej. http://localhost:12000), asi que hay que reconstruirlo a partir de
 * las cabeceras reenviadas. Devuelve "" si no se puede determinar.
 */
export function requestOrigin(req: Request): string {
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    (req.headers.get("x-forwarded-ssl") === "on" ? "https" : undefined) ??
    (req.headers.get("host")?.endsWith(":443") ? "https" : "http");
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? req.headers.get("host");
  if (!host) return "";
  return `${proto}://${host}`;
}

/** Enlace absoluto a un recurso del sitio. */
export function url(path = ""): string {
  const clean = path.replace(/^\/+/, "");
  return `${siteBaseUrl()}/${clean}`;
}
