#!/usr/bin/env node
/**
 * ============================================================================
 *  ARRANQUE DE LA BASE DE DATOS DURANTE EL BUILD
 * ----------------------------------------------------------------------------
 *  Aplica las migraciones de Prisma y siembra el contenido minimo. Se ejecuta
 *  como parte de "buildCommand" en Vercel, de modo que un despliegue deje la
 *  base de datos lista sin intervencion manual (no hace falta "vercel login"
 *  ni ejecutar ningun script desde la maquina del propietario).
 *
 *  Es SEGURO volver a ejecutarlo:
 *    - "migrate deploy" solo aplica migraciones pendientes.
 *    - La semilla actua unicamente sobre tablas vacias.
 *
 *  Es BEST-EFFORT: si no hay base de datos o no responde, avisa y deja que el
 *  build continue. La aplicacion no necesita la BD para compilar (todas las
 *  rutas se renderizan en peticion), asi que un fallo temporal de la base no
 *  debe tumbar un despliegue. Cuando la base vuelva, la siguiente build la
 *  deja al dia.
 * ============================================================================
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!url) {
  console.log("[db-bootstrap] Sin DATABASE_URL: se omite (build estatico).");
  process.exit(0);
}

function run(label, cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit", env: process.env });
  if (result.error) {
    console.warn(`[db-bootstrap] ${label}: ${result.error.message}`);
    return false;
  }
  if (result.status !== 0) {
    console.warn(`[db-bootstrap] ${label}: termino con codigo ${result.status}`);
    return false;
  }
  return true;
}

console.log("[db-bootstrap] Aplicando migraciones pendientes...");
if (!run("migrate deploy", process.execPath, ["scripts/prisma.mjs", "migrate", "deploy"])) {
  console.warn("[db-bootstrap] No se pudieron aplicar las migraciones; se continua.");
  process.exit(0);
}

// tsx puede no estar si el entorno no instala devDependencies: en ese caso la
// semilla se omite (no es critica para que la web funcione).
const tsx = path.join("node_modules", ".bin", "tsx");
if (existsSync(tsx)) {
  console.log("[db-bootstrap] Sembrando contenido (solo tablas vacias)...");
  run("seed", tsx, ["scripts/seed.ts"]);
} else {
  console.log("[db-bootstrap] tsx no disponible: se omite la semilla.");
}

console.log("[db-bootstrap] Base de datos lista.");
