import "server-only";
import { prisma } from "./db";
import { getConfig } from "./config";
import { faqFingerprint } from "./submissions";
import { cleanText } from "./validator";

/**
 * ============================================================================
 *  PREGUNTAS FRECUENTES E IMPORTANCIA  (puerto de app/lib/faq.php)
 * ----------------------------------------------------------------------------
 *  total = 8*score + 35*(1 - e^(-peticiones/umbral)) + 15*canal + 10*frescura
 * ============================================================================
 */

export interface RankedFaq {
  id: number;
  title: string;
  body: string;
  fuente: "panel" | "usuario";
  score: number;
  peticiones: number;
  created_at: string;
  importance: number;
}

/** Cuenta las peticiones de usuarios por huella normalizada. */
async function faqDemandCounts(): Promise<Record<string, number>> {
  const rows = await prisma.userSubmission.findMany({
    where: { stype: "pregunta" },
    select: { title: true },
  });
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const fp = faqFingerprint(r.title ?? "");
    if (fp === "") continue;
    counts[fp] = (counts[fp] ?? 0) + 1;
  }
  return counts;
}

/** Puntuacion de importancia (0-100). */
export function faqImportance(faq: {
  score: number;
  peticiones: number;
  fuente: string;
  created_at: string;
}): number {
  const cfg = getConfig().faq;

  const score = Math.max(0, Math.min(5, faq.score));
  const demand = Math.max(0, faq.peticiones);

  const w = score * cfg.weightWeight;

  const threshold = Math.max(1, cfg.demandThreshold);
  const d = demand > 0 ? cfg.weightDemand * (1 - Math.exp(-demand / threshold)) : 0;

  const channel = faq.fuente === "usuario" ? 1.0 : 0.6;
  const c = cfg.weightChannel * channel;

  const created = faq.created_at;
  const ageDays = created !== "" ? Math.max(0, (Date.now() - new Date(created).getTime()) / 86400000) : 3650;
  const halfLife = Math.max(1, cfg.freshnessHalflifeDays);
  const f = cfg.weightFreshness * Math.pow(0.5, ageDays / halfLife);

  return Math.round(Math.min(100, w + d + c + f) * 10) / 10;
}

/** Preguntas activas ordenadas por importancia. */
export async function faqsRanked(onlyPublished = true): Promise<RankedFaq[]> {
  const demand = await faqDemandCounts();
  const faqs: Omit<RankedFaq, "importance">[] = [];

  // A) Preguntas de la base (panel).
  const baseRows = await prisma.contentItem.findMany({
    where: { ctype: "faq" },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  for (const f of baseRows) {
    const fp = faqFingerprint(f.title ?? "");
    faqs.push({
      id: f.id,
      title: f.title ?? "",
      body: f.body ?? "",
      fuente: "panel",
      score: f.score,
      peticiones: demand[fp] ?? 0,
      created_at: f.createdAt ? fmt(f.createdAt) : "",
    });
  }

  // B) Preguntas propuestas por usuarios (agrupadas por huella).
  const userRows = await prisma.userSubmission.findMany({
    where: { stype: "pregunta" },
    orderBy: { createdAt: "desc" },
  });
  const seen = new Set<string>();
  for (const r of userRows) {
    const fp = faqFingerprint(r.title ?? "");
    if (fp === "" || seen.has(fp)) continue;
    if (onlyPublished && r.status !== "aprobada") {
      seen.add(fp);
      continue;
    }
    seen.add(fp);
    faqs.push({
      id: r.id,
      title: r.title ?? "",
      body: r.body ?? "",
      fuente: "usuario",
      score: r.score,
      peticiones: demand[fp] ?? 0,
      created_at: r.createdAt ? fmt(r.createdAt) : "",
    });
  }

  const ranked = faqs.map((f) => ({ ...f, importance: faqImportance(f) }));
  ranked.sort((a, b) => b.importance - a.importance);
  return ranked;
}

/** Preguntas mas relevantes para la portada. */
export async function faqsTop(limit = 6): Promise<RankedFaq[]> {
  const take = Math.max(1, Math.min(20, limit));
  const minScore = getConfig().faq.portalMinScore;
  const ranked = await faqsRanked();
  const out: RankedFaq[] = [];
  for (const f of ranked) {
    if (f.importance >= minScore) out.push(f);
    if (out.length >= take) break;
  }
  if (out.length === 0) return ranked.slice(0, take);
  return out;
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export { cleanText };
