import "server-only";
import { prisma } from "./db";

/**
 * ============================================================================
 *  CONTENIDO EDITABLE  (content_items)
 *  Servicios, proyectos, testimonios, proceso y FAQ. La web los consume via
 *  /api/index?resource=content. El panel los gestiona en /admin/content.
 * ============================================================================
 */

export interface ContentRow {
  id: number;
  ctype: string;
  title: string;
  subtitle: string;
  body: string;
  meta: unknown;
  sort_order: number;
}

/** Filas de contenido activas (todas o de un tipo). */
export async function contentItems(type?: string | null): Promise<ContentRow[]> {
  const rows = await prisma.contentItem.findMany({
    where: { isActive: true, ...(type ? { ctype: type } : {}) },
    orderBy: type ? [{ sortOrder: "asc" }, { id: "asc" }] : [{ ctype: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true, ctype: true, title: true, subtitle: true, body: true,
      meta: true, sortOrder: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    ctype: r.ctype,
    title: r.title ?? "",
    subtitle: r.subtitle ?? "",
    body: r.body ?? "",
    meta: r.meta ?? null,
    sort_order: r.sortOrder,
  }));
}

/** Elementos de contenido para el panel (todos, activos e inactivos). */
export async function contentForAdmin(type: string): Promise<ContentRow[]> {
  const rows = await prisma.contentItem.findMany({
    where: { ctype: type },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    ctype: r.ctype,
    title: r.title ?? "",
    subtitle: r.subtitle ?? "",
    body: r.body ?? "",
    meta: r.meta ?? null,
    sort_order: r.sortOrder,
  }));
}

/** Crea un elemento de contenido. */
export async function contentCreate(data: {
  ctype: string;
  title: string;
  subtitle: string;
  body: string;
  meta?: unknown;
  score?: number;
  sortOrder?: number;
}): Promise<number> {
  const row = await prisma.contentItem.create({
    data: {
      ctype: data.ctype,
      title: data.title,
      subtitle: data.subtitle,
      body: data.body,
      meta: (data.meta ?? null) as never,
      score: data.score ?? 0,
      sortOrder: data.sortOrder ?? 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  return row.id;
}

/** Actualiza un elemento de contenido. */
export async function contentUpdate(
  id: number,
  data: Partial<{ title: string; subtitle: string; body: string; meta: unknown; score: number; sortOrder: number; isActive: boolean }>,
): Promise<void> {
  await prisma.contentItem.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.subtitle !== undefined ? { subtitle: data.subtitle } : {}),
      ...(data.body !== undefined ? { body: data.body } : {}),
      ...(data.meta !== undefined ? { meta: data.meta as never } : {}),
      ...(data.score !== undefined ? { score: data.score } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      updatedAt: new Date(),
    },
  });
}

/** Elimina un elemento de contenido. */
export async function contentDelete(id: number): Promise<void> {
  await prisma.contentItem.delete({ where: { id } });
}
