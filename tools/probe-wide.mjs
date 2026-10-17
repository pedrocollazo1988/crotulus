/**
 * Localiza que elemento ensancha el layout. Uso: node tools/probe-wide.mjs <url> <width>
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const URL = process.argv[2] || "https://crotulus.vercel.app/index.html";
const W = parseInt(process.argv[3] || "390", 10);
const PORT = 9334;
const userDir = mkdtempSync(path.join(tmpdir(), "cdp-probe-"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chromium = spawn("/usr/bin/chromium", [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`,
  "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "about:blank",
], { stdio: "ignore" });

async function ws() {
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

const PROBE = `(() => {
  const iw = window.innerWidth;
  const out = [];
  document.querySelectorAll("body *").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < iw - 4) return;
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden") return;
    // ruta de ancestros para identificar
    const path = [];
    let n = el;
    for (let i = 0; i < 4 && n && n !== document.body; i++) {
      path.unshift(n.tagName.toLowerCase() + (n.id ? "#" + n.id : "") + (n.className && typeof n.className === "string" ? "." + n.className.trim().split(/\\s+/).join(".") : ""));
      n = n.parentElement;
    }
    out.push({ w: Math.round(r.width), right: Math.round(r.right), path: path.join(" > ").slice(0, 200) });
  });
  out.sort((a, b) => b.w - a.w);
  return { iw, scrollWidth: document.documentElement.scrollWidth, top: out.slice(0, 12) };
})()`;

const main = async () => {
  const sock = new WebSocket(await ws());
  await new Promise((r, j) => { sock.addEventListener("open", r); sock.addEventListener("error", j); });
  let id = 0; const pend = new Map();
  sock.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const { resolve, reject } = pend.get(m.id); pend.delete(m.id); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); }
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { resolve: res, reject: rej }); sock.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: URL });
  await sleep(3500);
  const r = await send("Runtime.evaluate", { expression: PROBE, returnByValue: true });
  const v = r.result.value;
  console.log(`innerWidth=${v.iw} scrollWidth=${v.scrollWidth}`);
  v.top.forEach((x) => console.log(`  ${x.w}px (right=${x.right})  ${x.path}`));
  sock.close();
};

main().catch((e) => console.error("FALLO:", e.message)).finally(async () => {
  chromium.kill("SIGKILL"); await sleep(300);
  try { rmSync(userDir, { recursive: true, force: true }); } catch {}
});
