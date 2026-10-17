/**
 * Mide cajas clave (hero, proyecto, post, avatar, logo) para detectar roturas de
 * layout tras envolver en <picture>. Uso: node tools/measure.mjs <url> <width>
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const URL = process.argv[2] || "http://127.0.0.1:8099/index.html";
const W = parseInt(process.argv[3] || "1440", 10);
const PORT = 9338;
const userDir = mkdtempSync(path.join(tmpdir(), "cdp-meas-"));
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

const EXPR = `(() => {
  const sel = [".hero__media img", ".project__media img", ".post__media img", ".testimonial__avatar", ".brand__img", ".team-card__media img"];
  const out = [];
  for (const s of sel) {
    const e = document.querySelector(s);
    if (!e) { out.push([s, "ausente"]); continue; }
    const r = e.getBoundingClientRect();
    const nat = [e.naturalWidth, e.naturalHeight];
    const st = getComputedStyle(e);
    out.push([s, Math.round(r.width) + "x" + Math.round(r.height), "natural " + nat.join("x"), "objectFit=" + st.objectFit, "display=" + st.display]);
  }
  return out;
})()`;

const main = async () => {
  const sock = new WebSocket(await wsUrl());
  await new Promise((r, j) => { sock.addEventListener("open", r); sock.addEventListener("error", j); });
  let id = 0; const pend = new Map();
  sock.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const { resolve, reject } = pend.get(m.id); pend.delete(m.id); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); }
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { resolve: res, reject: rej }); sock.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: 900, deviceScaleFactor: 1, mobile: W <= 820 });
  await send("Page.navigate", { url: URL });
  await sleep(3500);
  const r = await send("Runtime.evaluate", { expression: EXPR, returnByValue: true });
  for (const row of r.result.value) console.log("  " + row.join("  |  "));
  sock.close();
};

main().catch((e) => console.error("FALLO:", e.message)).finally(async () => {
  chromium.kill("SIGKILL"); await sleep(300);
  try { rmSync(userDir, { recursive: true, force: true }); } catch {}
});
