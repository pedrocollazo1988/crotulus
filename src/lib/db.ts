import "server-only";
import { PrismaClient } from "@prisma/client";

/**
 * Cliente Prisma unico (patron singleton).
 * En desarrollo, Next recarga los modulos en caliente: sin este global se
 * abriria una conexion nueva en cada recarga hasta agotar el pool.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
