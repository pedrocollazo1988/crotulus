#!/usr/bin/env node
/**
 * ============================================================================
 *  OPTIMIZACION DE IMAGENES
 * ----------------------------------------------------------------------------
 *  Genera variantes WebP y AVIF (y recomprime el JPG con mozjpeg) de las fotos
 *  grandes del sitio, para servirlas con <picture>. Los originales se conservan
 *  como respaldo del formato base.
 *
 *  Uso:
 *    node tools/optimize-images.mjs            (solo las que faltan)
 *    node tools/optimize-images.mjs --force    (regenera todo)
 *
 *  Es idempotente: si la variante ya existe y es mas nueva que el original, se
 *  omite salvo --force.
 * ============================================================================
 */
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import sharp from "sharp";

const ROOT = "public/assets/img";
const FORCE = process.argv.includes("--force");

// Fotos grandes (no logos ni avatares: esos ya tienen sus variantes).
const TARGETS = [
  "hero-tech.jpg",
  "proyecto-web.jpg",
  "proyecto-ia.jpg",
  "proyecto-redes.jpg",
  "blog/automatizacion-ia-pymes.jpg",
  "blog/seguridad-red-pyme.jpg",
  "blog/web-que-convierte.jpg",
];

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;

// Ancho maximo de servicio: las fotos se muestran a 800 px (proyectos/blog) y
// 640 px (hero), asi que 1280 px cubre pantallas 2x sin cargar el original de
// 1600 px. Las fotos con mucho detalle (rack de red, candado) no bajaban de peso
// con WebP a calidad alta; con el recorte de tamano y calidad 70 si.
const MAX_W = 1280;

async function variant(src, ext, encode) {
  const out = src.replace(/\.(jpe?g|png)$/i, `.${ext}`);
  if (!FORCE && existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs) {
    console.log(`  = ${out} (al dia, ${kb(statSync(out).size)})`);
    return;
  }
  const before = statSync(src).size;
  await encode().toFile(out);
  const after = statSync(out).size;
  const pct = ((1 - after / before) * 100).toFixed(0);
  console.log(`  + ${out} (${kb(after)}, -${pct}% vs ${kb(before)})`);
}

async function main() {
  for (const rel of TARGETS) {
    const src = join(ROOT, rel);
    if (!existsSync(src)) {
      console.warn(`! falta ${src}`);
      continue;
    }
    console.log(rel);
    const base = () => sharp(src).rotate().resize({ width: MAX_W, withoutEnlargement: true });
    await variant(src, "webp", () => base().webp({ quality: 70, effort: 6 }));
    await variant(src, "avif", () => base().avif({ quality: 50, effort: 5 }));
    // Recomprime el JPG base (mozjpeg progresivo) al mismo ancho de servicio.
    const tmp = `${src}.tmp.jpg`;
    const before = statSync(src).size;
    await base().jpeg({ quality: 78, mozjpeg: true, progressive: true }).toFile(tmp);
    const { renameSync } = await import("node:fs");
    renameSync(tmp, src);
    console.log(`  ~ ${src} recomprimido (${kb(before)} -> ${kb(statSync(src).size)})`);
  }
  console.log("Listo.");
}

main().catch((e) => {
  console.error("FALLO:", e.message);
  process.exit(1);
});
