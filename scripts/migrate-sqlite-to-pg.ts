import { PrismaClient } from "@prisma/client";
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * ============================================================================
 *  MIGRACION DE DATOS: SQLite (backend PHP antiguo) -> PostgreSQL (Prisma)
 * ----------------------------------------------------------------------------
 *  Uso:
 *    npm run db:migrate-sqlite                     # ruta por defecto
 *    npm run db:migrate-sqlite -- ruta/al.sqlite   # ruta explicita
 *    SQLITE_PATH=... npm run db:migrate-sqlite
 *    npm run db:migrate-sqlite -- --force          # pisa tablas ya pobladas
 *
 *  Conserva los IDs originales y, al terminar, reajusta las secuencias de
 *  Postgres (setval) para que los INSERT nuevos no choquen con lo importado.
 *  Es idempotente: por defecto omite las tablas que ya tienen filas.
 * ============================================================================
 */

const args = process.argv.slice(2);
const force = args.includes("--force");
const positional = args.filter((a) => !a.startsWith("--"));

const DEFAULT_SQLITE = path.join("legacy", "app", "data", "c-rotulus.sqlite");
const sqlitePath = path.resolve(
  process.env.SQLITE_PATH || positional[0] || DEFAULT_SQLITE,
);

if (!existsSync(sqlitePath)) {
  console.error(`[migracion] No se encuentra el SQLite: ${sqlitePath}`);
  console.error("[migracion] Pasa la ruta: npm run db:migrate-sqlite -- /ruta/c-rotulus.sqlite");
  process.exit(1);
}

const prisma = new PrismaClient();
const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });

/** Lee una tabla del SQLite (devuelve [] si no existe). */
function rows(table: string): Record<string, unknown>[] {
  try {
    return sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
  } catch {
    return [];
  }
}

/** Convierte meta TEXT (json_encode) en un objeto JSON o null. */
function parseMeta(value: unknown): unknown {
  if (value == null || value === "") return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function toBool(value: unknown, fallback = true): boolean {
  if (value == null || value === "") return fallback;
  return Number(value) !== 0;
}

function toDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const d = new Date(String(value).replace(" ", "T") + (String(value).includes("T") ? "" : "Z"));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function str(value: unknown, fallback = ""): string {
  return value == null ? fallback : String(value);
}

/**
 * Importa una tabla: omite si ya tiene datos (salvo --force) y crea cada fila
 * con su ID original. Devuelve cuantas filas se crearon.
 */
async function importTable(
  name: string,
  count: () => Promise<number>,
  create: (row: Record<string, unknown>) => Promise<unknown>,
): Promise<number> {
  const source = rows(name);
  if (source.length === 0) {
    console.log(`  ${name}: sin datos en SQLite`);
    return 0;
  }
  const existing = await count();
  if (existing > 0 && !force) {
    console.log(`  ${name}: ya tiene ${existing} filas, se omite (usa --force)`);
    return 0;
  }

  let done = 0;
  for (const row of source) {
    try {
      await create(row);
      done++;
    } catch (err) {
      console.warn(`  ${name} (id ${row.id}): ${(err as Error).message}`);
    }
  }
  console.log(`  ${name}: ${done}/${source.length} filas importadas`);
  return done;
}

/** Reajusta la secuencia de una tabla tras importar IDs explicitos. */
async function fixSequence(table: string, column = "id"): Promise<void> {
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('${table}', '${column}'),
       COALESCE((SELECT MAX(${column}) FROM ${table}), 0) + 1, false)`,
  );
}

async function main(): Promise<void> {
  console.log(`[migracion] Origen: ${sqlitePath}`);
  console.log(`[migracion] Destino: ${process.env.DATABASE_URL?.replace(/:[^:@/]*@/, ":****@") ?? "(sin DATABASE_URL)"}`);
  if (force) console.log("[migracion] Modo --force: se reimportaran las tablas con datos.\n");

  const touched: string[] = [];

  const steps: [string, () => Promise<number>][] = [
    ["users", () =>
      importTable(
        "users",
        () => prisma.user.count(),
        (r) =>
          prisma.user.create({
            data: {
              id: toInt(r.id),
              email: str(r.email),
              name: str(r.name),
              passwordHash: r.password_hash == null ? null : str(r.password_hash),
              role: str(r.role, "user"),
              status: str(r.status, "pending"),
              emailVerifiedAt: toDate(r.email_verified_at),
              googleId: r.google_id == null || r.google_id === "" ? null : str(r.google_id),
              avatarUrl: r.avatar_url == null ? null : str(r.avatar_url),
              lastLoginAt: toDate(r.last_login_at),
              createdAt: toDate(r.created_at),
              updatedAt: toDate(r.updated_at),
            },
          }),
      )],
    ["content_items", () =>
      importTable(
        "content_items",
        () => prisma.contentItem.count(),
        (r) =>
          prisma.contentItem.create({
            data: {
              id: toInt(r.id),
              ctype: str(r.ctype),
              title: str(r.title),
              subtitle: str(r.subtitle),
              body: r.body == null ? null : str(r.body),
              meta: parseMeta(r.meta) as never,
              sortOrder: toInt(r.sort_order),
              score: toInt(r.score),
              isActive: toBool(r.is_active),
              createdAt: toDate(r.created_at),
              updatedAt: toDate(r.updated_at),
            },
          }),
      )],
    ["settings", () =>
      importTable(
        "settings",
        () => prisma.setting.count(),
        (r) =>
          prisma.setting.create({
            data: {
              skey: str(r.skey),
              svalue: r.svalue == null ? null : str(r.svalue),
              updatedAt: toDate(r.updated_at),
            },
          }),
      )],
    ["blog_posts", () =>
      importTable(
        "blog_posts",
        () => prisma.blogPost.count(),
        (r) =>
          prisma.blogPost.create({
            data: {
              id: toInt(r.id),
              slug: str(r.slug),
              title: str(r.title),
              excerpt: r.excerpt == null ? null : str(r.excerpt),
              body: r.body == null ? null : str(r.body),
              category: str(r.category),
              author: str(r.author),
              image: str(r.image),
              meta: parseMeta(r.meta) as never,
              sortOrder: toInt(r.sort_order),
              isActive: toBool(r.is_active),
              publishedAt: toDate(r.published_at),
              createdAt: toDate(r.created_at),
              updatedAt: toDate(r.updated_at),
            },
          }),
      )],
    ["team_members", () =>
      importTable(
        "team_members",
        () => prisma.teamMember.count(),
        (r) =>
          prisma.teamMember.create({
            data: {
              id: toInt(r.id),
              name: str(r.name),
              role: str(r.role),
              bio: r.bio == null ? null : str(r.bio),
              email: str(r.email),
              phone: str(r.phone),
              avatar: str(r.avatar),
              meta: parseMeta(r.meta) as never,
              sortOrder: toInt(r.sort_order),
              isActive: toBool(r.is_active),
              createdAt: toDate(r.created_at),
              updatedAt: toDate(r.updated_at),
            },
          }),
      )],
    ["user_submissions", () =>
      importTable(
        "user_submissions",
        () => prisma.userSubmission.count(),
        (r) =>
          prisma.userSubmission.create({
            data: {
              id: toInt(r.id),
              userId: toInt(r.user_id),
              stype: str(r.stype),
              title: str(r.title),
              body: r.body == null ? null : str(r.body),
              status: str(r.status, "pendiente"),
              score: toInt(r.score),
              ip: str(r.ip),
              createdAt: toDate(r.created_at),
              updatedAt: toDate(r.updated_at),
            },
          }),
      )],
    ["reviews", () =>
      importTable(
        "reviews",
        () => prisma.review.count(),
        (r) =>
          prisma.review.create({
            data: {
              id: toInt(r.id),
              targetType: str(r.target_type),
              targetId: toInt(r.target_id),
              targetLabel: str(r.target_label),
              rating: toInt(r.rating, 5),
              authorName: str(r.author_name),
              authorEmail: str(r.author_email),
              comment: r.comment == null ? null : str(r.comment),
              userId: toInt(r.user_id),
              status: str(r.status, "pendiente"),
              ip: str(r.ip),
              userAgent: str(r.user_agent),
              createdAt: toDate(r.created_at),
            },
          }),
      )],
    ["contact_messages", () =>
      importTable(
        "contact_messages",
        () => prisma.contactMessage.count(),
        (r) =>
          prisma.contactMessage.create({
            data: {
              id: toInt(r.id),
              userId: toInt(r.user_id),
              name: str(r.name),
              email: str(r.email),
              phone: str(r.phone),
              service: str(r.service),
              message: str(r.message),
              status: str(r.status, "nuevo"),
              ip: str(r.ip),
              userAgent: str(r.user_agent),
              createdAt: toDate(r.created_at),
            },
          }),
      )],
  ];

  for (const [name, run] of steps) {
    const n = await run();
    if (n > 0) touched.push(name);
  }

  // Reajusta las secuencias de las tablas con ID explicito.
  for (const table of touched) {
    if (table === "settings") continue;
    await fixSequence(table);
  }

  // Las sesiones y tokens no se migran: son efimeros y dependen del hash local.
  console.log("\n[migracion] Hecho. Sesiones y tokens no se migran (caducan igual).");
  console.log("[migracion] Verifica los conteos con: npm run db:migrate-sqlite -- --force  (idempotente)");
}

main()
  .catch((err) => {
    console.error("[migracion] ERROR:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    sqlite.close();
    await prisma.$disconnect();
  });
