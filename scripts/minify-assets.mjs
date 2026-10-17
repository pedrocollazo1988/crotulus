#!/usr/bin/env node
/**
 * ============================================================================
 *  MINIFICACION DE ASSETS (CSS y JS)
 * ----------------------------------------------------------------------------
 *  Genera las versiones .min de los assets servidos al navegador. Las fuentes
 *  legibles (styles.css, main.js, admin.css, admin-auth.js) se conservan para
 *  editarlas; el HTML y los componentes del panel cargan las .min.
 *
 *  Uso:  node scripts/minify-assets.mjs
 *  Se ejecuta tambien en el build de Vercel para que las .min nunca queden
 *  desfasadas respecto a las fuentes.
 * ============================================================================
 */
import { readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { transform } from "esbuild";

const JOBS = [
  { src: "public/css/styles.css",        out: "public/css/styles.min.css",  loader: "css" },
  { src: "public/js/main.js",            out: "public/js/main.min.js",      loader: "js" },
  { src: "public/admin/assets/admin.css",      out: "public/admin/assets/admin.min.css",      loader: "css" },
  { src: "public/admin/assets/admin-auth.js",  out: "public/admin/assets/admin-auth.min.js",  loader: "js" },
];

const kb = (n) => `${(n / 1024).toFixed(1)}KB`;

async function main() {
  let totalBefore = 0;
  let totalAfter = 0;
  for (const { src, out, loader } of JOBS) {
    if (!existsSync(src)) {
      console.warn(`! falta ${src}, se omite`);
      continue;
    }
    const code = readFileSync(src, "utf8");
    const { code: min } = await transform(code, { loader, minify: true });
    writeFileSync(out, min);
    const before = statSync(src).size;
    const after = Buffer.byteLength(min);
    totalBefore += before;
    totalAfter += after;
    const pct = ((1 - after / before) * 100).toFixed(0);
    console.log(`${src}  ${kb(before)} -> ${kb(after)}  (-${pct}%)`);
  }
  console.log(`Total: ${kb(totalBefore)} -> ${kb(totalAfter)}`);
}

main().catch((e) => {
  console.error("FALLO:", e.message);
  process.exit(1);
});
