import "server-only";
import { prisma } from "./db";
import { setting } from "./settings";
import { cleanText } from "./validator";

/**
 * ============================================================================
 *  APORTACIONES DE USUARIOS  (puerto de app/lib/submissions.php)
 *  Testimonios y preguntas que envian las personas con sesion iniciada.
 * ============================================================================
 */

export function submissionTypes(): Record<string, string> {
  return { testimonio: "Testimonio", pregunta: "Pregunta frecuente" };
}

export function submissionStatusLabels(): Record<string, string> {
  return { pendiente: "Pendiente", aprobada: "Aprobada", rechazada: "Rechazada" };
}

/** ¿Esta activo el modulo de aportaciones? */
export async function submissionsEnabled(): Promise<boolean> {
  return (await setting("submissions_enabled", "1")) === "1";
}

/** ¿Se publican solas las aportaciones nuevas? */
export async function submissionsAutoApprove(): Promise<boolean> {
  return (await setting("submissions_auto_approve", "0")) === "1";
}

/** ¿Se muestra el formulario publico de testimonios en la portada? */
export async function testimonialsFormEnabled(): Promise<boolean> {
  return (await setting("testimonials_form_enabled", "1")) === "1";
}

/** Etiqueta del tipo de aportacion. */
export function submissionTypeLabel(type: string): string {
  return submissionTypes()[type] ?? type;
}

/** Aportaciones de un usuario. */
export async function submissionsForUser(userId: number, limit = 20) {
  const take = Math.max(1, Math.min(100, limit));
  const rows = await prisma.userSubmission.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, stype: true, title: true, body: true, status: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, created_at: fmt(r.createdAt) }));
}

/** Aportaciones para el panel, con filtros. */
export async function submissionsForAdmin(type = "", status = "") {
  const where: Record<string, unknown> = {};
  if (type && type in submissionTypes()) where.stype = type;
  if (status && status in submissionStatusLabels()) where.status = status;

  const rows = await prisma.userSubmission.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 500,
    include: { user: { select: { name: true, email: true } } },
  });
  const ordered = rows.sort((a, b) => {
    const rank = (s: string) => (s === "pendiente" ? 0 : s === "aprobada" ? 1 : 2);
    const d = rank(a.status) - rank(b.status);
    return d !== 0 ? d : (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
  });
  return ordered.map((r) => ({
    ...r,
    user_name: r.user?.name ?? "",
    user_email: r.user?.email ?? "",
    created_at: fmt(r.createdAt),
  }));
}

/** Cambia el estado de moderacion. */
export async function submissionSetStatus(id: number, status: string): Promise<boolean> {
  if (id <= 0 || !(status in submissionStatusLabels())) return false;
  await prisma.userSubmission.update({ where: { id }, data: { status, updatedAt: new Date() } });
  return true;
}

/** Cambia el peso manual (importancia). */
export async function submissionSetScore(id: number, score: number): Promise<boolean> {
  if (id <= 0) return false;
  await prisma.userSubmission.update({
    where: { id },
    data: { score: Math.max(0, Math.min(5, score)), updatedAt: new Date() },
  });
  return true;
}

/** Testimonios aprobados, listos para publicar. */
export async function testimonialsPublished(limit = 12) {
  const take = Math.max(1, Math.min(50, limit));
  const rows = await prisma.userSubmission.findMany({
    where: { stype: "testimonio", status: "aprobada" },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true, title: true, body: true, authorRole: true, rating: true,
      createdAt: true, user: { select: { avatarUrl: true } },
    },
  });
  // La foto (data URL) puede pesar; se consulta aparte solo para saber quien
  // la tiene, en vez de traer los blobs en el listado.
  const withPhoto = rows.length
    ? new Set(
        (
          await prisma.userSubmission.findMany({
            where: { id: { in: rows.map((r) => r.id) }, photoData: { not: null } },
            select: { id: true },
          })
        ).map((r) => r.id),
      )
    : new Set<number>();
  return rows.map((r) => ({
    id: r.id,
    title: r.title ?? "",
    body: r.body ?? "",
    role: r.authorRole ?? "",
    rating: r.rating,
    created_at: fmt(r.createdAt),
    avatar_url: r.user?.avatarUrl ?? (withPhoto.has(r.id) ? `/api/testimonial-photo/${r.id}` : ""),
  }));
}

/** Normaliza texto para agrupar preguntas equivalentes. */
export function faqFingerprint(text: string): string {
  const t = cleanText(text).toLowerCase().replace(/[¿?¡!.,;:"'`´()[\]{}]/gu, " ").replace(/\s+/gu, " ").trim();
  return [...t].slice(0, 80).join("");
}

function fmt(d: Date | null): string {
  return d ? d.toISOString().slice(0, 19).replace("T", " ") : "";
}
