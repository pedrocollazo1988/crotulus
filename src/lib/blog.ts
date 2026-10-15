import "server-only";
import { prisma } from "./db";

/**
 * ============================================================================
 *  BLOG  (puerto de app/lib/blog.php)
 * ============================================================================
 */

export interface BlogPostRow {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: string;
  author: string;
  image: string;
  meta: Record<string, unknown> | null;
  publishedAt: Date | null;
}

/** Articulos publicados (o todos si onlyActive = false). */
export async function blogPosts(limit = 0, onlyActive = true, withBody = false): Promise<BlogPostRow[]> {
  const rows = await prisma.blogPost.findMany({
    where: onlyActive ? { isActive: true } : {},
    orderBy: [{ publishedAt: "desc" }, { sortOrder: "asc" }, { id: "desc" }],
    ...(limit > 0 ? { take: Math.max(1, limit) } : {}),
  });
  return rows.map((r) => toRow(r, withBody));
}

/** Articulo por id. */
export async function blogPostById(id: number): Promise<BlogPostRow | null> {
  const r = await prisma.blogPost.findUnique({ where: { id } });
  return r ? toRow(r, true) : null;
}

/** Convierte una fila al formato publico que espera main.js. */
export function blogPostPublic(row: BlogPostRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    category: row.category,
    author: row.author,
    image: row.image,
    reading_minutes: Number(row.meta?.["reading_minutes"] ?? 0),
    published_at: row.publishedAt ? row.publishedAt.toISOString().slice(0, 19).replace("T", " ") : "",
  };
}

function toRow(r: {
  id: number; slug: string; title: string | null; excerpt: string | null; body: string | null;
  category: string | null; author: string | null; image: string | null; meta: unknown; publishedAt: Date | null;
}, withBody: boolean): BlogPostRow {
  return {
    id: r.id,
    slug: r.slug ?? "",
    title: r.title ?? "",
    excerpt: r.excerpt ?? "",
    body: withBody ? (r.body ?? "") : "",
    category: r.category ?? "",
    author: r.author ?? "",
    image: r.image ?? "",
    meta: (r.meta as Record<string, unknown> | null) ?? null,
    publishedAt: r.publishedAt,
  };
}
