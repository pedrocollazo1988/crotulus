import "server-only";
import { prisma } from "./db";
import { setting } from "./settings";

/**
 * ============================================================================
 *  VALORACIONES  (puerto de app/lib/reviews.php)
 * ============================================================================
 */

export function reviewTargetTypes(): string[] {
  return ["servicio", "proyecto", "general"];
}

export function reviewStatusLabels(): Record<string, string> {
  return { pendiente: "Pendiente", aprobada: "Aprobada", rechazada: "Rechazada" };
}

/** ¿Esta activo el modulo de valoraciones? */
export async function reviewsEnabled(): Promise<boolean> {
  return (await setting("reviews_enabled", "1")) === "1";
}

/** ¿Se publican solas las valoraciones nuevas? */
export async function reviewsAutoApprove(): Promise<boolean> {
  return (await setting("reviews_auto_approve", "0")) === "1";
}

/** Media y total de valoraciones aprobadas. */
export async function reviewsSummary(targetType?: string | null, targetId?: number | null) {
  const where: Record<string, unknown> = { status: "aprobada" };
  if (targetType) where.targetType = targetType;
  if (targetId !== null && targetId !== undefined) where.targetId = targetId;

  const agg = await prisma.review.aggregate({
    where,
    _count: { _all: true },
    _avg: { rating: true },
  });
  const total = agg._count._all;
  const average = total ? Math.round((agg._avg.rating ?? 0) * 10) / 10 : 0;
  return { total, average, stars: total ? Math.round(average) : 0 };
}

/** Valoraciones aprobadas mas recientes. */
export async function reviewsPublished(targetType = "", limit = 12) {
  const take = Math.max(1, Math.min(50, limit));
  const where: Record<string, unknown> = { status: "aprobada" };
  if (targetType && reviewTargetTypes().includes(targetType)) where.targetType = targetType;

  const rows = await prisma.review.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true, targetType: true, targetId: true, targetLabel: true,
      rating: true, authorName: true, comment: true, createdAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    target_type: r.targetType,
    target_id: r.targetId,
    target_label: r.targetLabel ?? "",
    rating: r.rating,
    author_name: r.authorName,
    comment: r.comment ?? "",
    created_at: fmt(r.createdAt),
  }));
}

/** Valoraciones para el panel. */
export async function reviewsForAdmin(status = "") {
  const where: Record<string, unknown> = {};
  if (status && status in reviewStatusLabels()) where.status = status;
  const rows = await prisma.review.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 500,
  });
  return rows.map((r) => ({ ...r, created_at: fmt(r.createdAt) }));
}

/** Cambia el estado de una valoracion. */
export async function reviewSetStatus(id: number, status: string): Promise<boolean> {
  if (id <= 0 || !(status in reviewStatusLabels())) return false;
  await prisma.review.update({ where: { id }, data: { status } });
  return true;
}

/** Elimina una valoracion. */
export async function reviewDelete(id: number): Promise<void> {
  await prisma.review.delete({ where: { id } });
}

function fmt(d: Date | null): string {
  return d ? d.toISOString().slice(0, 19).replace("T", " ") : "";
}
