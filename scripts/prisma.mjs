#!/usr/bin/env node
/**
 * ============================================================================
 *  ENVOLTORIO DEL CLI DE PRISMA  (compatibilidad con Neon en Vercel)
 * ----------------------------------------------------------------------------
 *  El esquema exige DIRECT_URL (prisma/schema.prisma -> directUrl). La
 *  integracion de Neon del Marketplace de Vercel inyecta DATABASE_URL (con
 *  pooler) y DATABASE_URL_UNPOOLED (directa), pero NO DIRECT_URL, asi que
 *  "prisma migrate deploy" fallaba con P1012 "Environment variable not found:
 *  DIRECT_URL".
 *
 *  Aqui se rellena DIRECT_URL, si falta, a partir de lo que haya:
 *      DATABASE_URL_UNPOOLED  ->  DATABASE_URL
 *
 *  Uso:  node scripts/prisma.mjs <args del CLI>     (npm run db:*)
 * ============================================================================
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

if (!process.env.DIRECT_URL) {
  const direct = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (direct) process.env.DIRECT_URL = direct;
}

// El binario de Prisma puede no estar en el PATH (p. ej. en el build de Vercel
// se invoca "node scripts/prisma.mjs" directamente, sin pasar por npm). Se
// resuelve la ruta real dentro de node_modules y, si no, se deja "prisma".
function prismaBin() {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require.resolve("prisma/package.json");
    const bin = path.join(path.dirname(pkg), "build", "index.js");
    if (existsSync(bin)) return { cmd: process.execPath, prefix: [bin] };
  } catch {
    /* sin prisma resoluble: se usa el PATH */
  }
  return { cmd: "prisma", prefix: [] };
}

const args = process.argv.slice(2);
const { cmd, prefix } = prismaBin();
const result = spawnSync(cmd, [...prefix, ...args], { stdio: "inherit", env: process.env });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
