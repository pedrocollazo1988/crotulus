/**
 * Comprueba en el navegador que la pagina carga el CSS/JS minificado, que las
 * imagenes se sirven en AVIF/WebP (formato realmente elegido) y que no hay
 * errores de consola. Uso: node tools/check-page.mjs <url>
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const URL = process.argv[2] || "http://127.0.0.1:8099/index.html";
const PORT = 9339;
const userDir = mkdtempSync(path.join(tmpdir(), "cdp-page-"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chromium = spawn("/usr/bin/chromium", [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`,
  "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "about:blank",
], { stdio: "ignore" });

async function wsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (p) return p.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("sin CDP");
}

const main = async () => {
  const sock = new WebSocket(await wsUrl());
  await new Promise((r, j) => { sock.addEventListener("open", r); sock.addEventListener("error", j); });
  let id = 0; const pend = new Map(); const errors = []; const responses = []; const failed = []; const reqs = [];
  sock.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error") errors.push(m.params.entry.text);
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text + " " + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || ""));
    if (m.method === "Network.responseReceived") {
      const r = m.params.response;
      if (/\.(avif|webp|jpe?g|png|css|js)(\?|$)/.test(r.url)) responses.push({ url: r.url.replace(/^https?:\/\/[^/]+/, ""), type: r.mimeType, fromCache: r.fromDiskCache });
    }
    if (m.method === "Network.loadingFailed") failed.push(m.params.errorText + " " + (m.params.requestId || ""));
    if (m.method === "Network.requestWillBeSent" && m.params.request) {
      const u = m.params.request.url;
      if (!/\.(avif|webp|jpe?g|png|css|js|woff2?)(\?|$)/.test(u)) reqs.push(u.replace(/^https?:\/\/[^/]+/, ""));
    }
    if (m.id && pend.has(m.id)) { const { resolve, reject } = pend.get(m.id); pend.delete(m.id); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); }
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { resolve: res, reject: rej }); sock.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: URL });
  await sleep(3000);
  // Desplaza por la pagina para que las imagenes lazy se soliciten.
  await send("Runtime.evaluate", { expression: `(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 180)); }
    window.scrollTo(0, 0);
  })()`, awaitPromise: true });
  await sleep(2000);
  const ev = await send("Runtime.evaluate", {
    expression: `(() => {
      const imgs = [...document.querySelectorAll("img")];
      return {
        title: document.title,
        css: [...document.styleSheets].map(s => s.href).filter(Boolean).map(h => h.replace(/^https?:\\/\\/[^/]+/, "")),
        scripts: [...document.querySelectorAll("script[src]")].map(s => s.getAttribute("src")),
        pics: document.querySelectorAll("picture").length,
        imgs: imgs.length,
        broken: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute("src")),
      };
    })()`, returnByValue: true,
  });
  const v = ev.result.value;
  console.log("title:", v.title);
  console.log("hojas CSS:", v.css.join(", "));
  console.log("scripts:", v.scripts.filter(s => s.includes("main")).join(", "));
  console.log("<picture>:", v.pics, " <img>:", v.imgs);
  console.log("imagenes rotas:", v.broken.length ? v.broken.join(", ") : "ninguna");
  console.log("errores consola:", errors.length ? errors.slice(0, 5).join(" | ") : "ninguno");
  const avif = responses.filter(r => r.url.endsWith(".avif"));
  const webp = responses.filter(r => r.url.endsWith(".webp"));
  const jpg = responses.filter(r => /\.jpe?g$/.test(r.url));
  console.log(`descargas -> avif:${avif.length} webp:${webp.length} jpg:${jpg.length}`);
  console.log("peticiones no-asset:", [...new Set(reqs)].join(", ") || "ninguna");
  console.log("fallos de red:", failed.length ? failed.slice(0, 5).join(" | ") : "ninguno");
  sock.close();
};

main().catch((e) => console.error("FALLO:", e.message)).finally(async () => {
  chromium.kill("SIGKILL"); await sleep(300);
  try { rmSync(userDir, { recursive: true, force: true }); } catch {}
});
