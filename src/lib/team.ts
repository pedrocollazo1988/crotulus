import "server-only";
import { prisma } from "./db";

/**
 * ============================================================================
 *  EQUIPO  (puerto de app/lib/team.php)
 * ============================================================================
 */

export interface TeamMemberRow {
  id: number;
  name: string;
  role: string;
  bio: string;
  email: string;
  phone: string;
  avatar: string;
  meta: Record<string, unknown> | null;
}

export async function teamMembers(onlyActive = true): Promise<TeamMemberRow[]> {
  const rows = await prisma.teamMember.findMany({
    where: onlyActive ? { isActive: true } : {},
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  return rows.map(toRow);
}

export async function teamMemberById(id: number): Promise<TeamMemberRow | null> {
  const r = await prisma.teamMember.findUnique({ where: { id } });
  return r ? toRow(r) : null;
}

/** Formato publico que espera main.js. */
export function teamMemberPublic(row: TeamMemberRow) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    bio: row.bio,
    email: row.email,
    phone: row.phone,
    avatar: row.avatar,
    linkedin: String(row.meta?.["linkedin"] ?? ""),
  };
}

function toRow(r: {
  id: number; name: string | null; role: string | null; bio: string | null;
  email: string | null; phone: string | null; avatar: string | null; meta: unknown;
}): TeamMemberRow {
  return {
    id: r.id,
    name: r.name ?? "",
    role: r.role ?? "",
    bio: r.bio ?? "",
    email: r.email ?? "",
    phone: r.phone ?? "",
    avatar: r.avatar ?? "",
    meta: (r.meta as Record<string, unknown> | null) ?? null,
  };
}
