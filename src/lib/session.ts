import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./db";
import { getConfig } from "./config";

/**
 * ============================================================================
 *  SESIONES (puerto de app/lib/security.php + app/lib/session_db.php)
 * ----------------------------------------------------------------------------
 *  El backend PHP guardaba la sesion en archivos (efimeros en serverless) o en
 *  la tabla php_sessions. En Next la sesion vive en la tabla "sessions":
 *  la cookie solo lleva un token aleatorio; en la BD se guarda su hash HMAC.
 * ============================================================================
 */

/** Token aleatorio en claro. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/** Huella HMAC del token (nunca se guarda el token en claro). */
export function tokenHash(token: string): string {
  return createHash("sha256").update(token + "|" + getConfig().security.appKey).digest("hex");
}

export interface SessionUser {
  uid: number;
  sid: number;
}

/** Crea una sesion para el usuario y devuelve el token de la cookie. */
export async function createSession(
  userId: number,
  ip: string,
  ua: string,
): Promise<{ token: string; sid: number }> {
  const token = generateToken(32);
  const lifetime = getConfig().security.sessionLifetime;
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: tokenHash(token),
      ip,
      userAgent: ua.slice(0, 255),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + lifetime * 1000),
    },
  });
  return { token, sid: session.id };
}

/** Guarda la cookie de sesion. */
export async function setSessionCookie(token: string): Promise<void> {
  const cfg = getConfig();
  const store = await cookies();
  store.set(cfg.security.sessionName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: cfg.security.sessionLifetime,
  });
}

/** Borra la cookie de sesion. */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(getConfig().security.sessionName);
}

/** Lee la sesion actual desde la cookie (o null). */
export async function readSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(getConfig().security.sessionName)?.value;
  if (!token) return null;

  const session = await prisma.session.findFirst({
    where: { tokenHash: tokenHash(token) },
    select: { id: true, userId: true, revokedAt: true, expiresAt: true },
  });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt && session.expiresAt.getTime() < Date.now()) return null;

  return { uid: session.userId, sid: session.id };
}

/** Revoca la sesion actual en la BD. */
export async function revokeCurrentSession(): Promise<void> {
  const current = await readSession();
  if (!current) return;
  await prisma.session.update({
    where: { id: current.sid },
    data: { revokedAt: new Date() },
  });
}

/** Limpia sesiones caducadas (equivalente a gc). */
export async function pruneSessions(): Promise<number> {
  const res = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return res.count;
}
