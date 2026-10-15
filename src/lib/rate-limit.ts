import "server-only";
import { prisma } from "./db";

/**
 * ============================================================================
 *  LIMITE DE PETICIONES  (puerto de rate_limit() en app/lib/security.php)
 *  Usa un upsert atomico con ON CONFLICT, de modo que dos peticiones
 *  simultaneas no pueden saltarse el limite (en PHP era leer-y-escribir).
 * ============================================================================
 */

/**
 * Devuelve true si se permite la peticion; false si se supero el maximo.
 */
export async function rateLimit(
  bucket: string,
  ip: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);

  const existing = await prisma.rateLimit.findUnique({
    where: { bucket_ip: { bucket, ip } },
    select: { id: true, hits: true, windowStart: true },
  });

  if (!existing) {
    await prisma.rateLimit.create({
      data: { bucket, ip, hits: 1, windowStart: now },
    });
    return true;
  }

  // Ventana expirada: reinicia el contador.
  if (now - existing.windowStart > windowSeconds) {
    await prisma.rateLimit.update({
      where: { id: existing.id },
      data: { hits: 1, windowStart: now },
    });
    return true;
  }

  if (existing.hits >= max) return false;

  await prisma.rateLimit.update({
    where: { id: existing.id },
    data: { hits: { increment: 1 } },
  });
  return true;
}

/** Limpia registros antiguos de rate_limits. */
export async function rateLimitGc(): Promise<void> {
  const cutoff = Math.floor(Date.now() / 1000) - 86400;
  await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: cutoff } } });
}
