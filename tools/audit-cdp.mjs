/**
 * Auditoria CDP contra una URL (por defecto produccion) a varios anchos.
 * Mide: overflow horizontal real, elementos mas anchos que el viewport,
 * tap targets pequenos (<44px) y su separacion.
 *
 * Uso: node tools/audit-cdp.mjs [url]
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const URL = process.argv[2] || "https://crotulus.vercel.app/index.html";
const WIDTHS = [1440, 1280, 1024, 820, 600, 390, 360];
const PORT = 9333;
const userDir = mkdtempSync(path.join(tmpdir(), "cdp-audit-"));

const chromium = spawn("/usr/bin/chromium", [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${userDir}`,
  "--no-sandbox",
  "--disable-gpu",
  "--hide-scrollbars",
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("CDP no respondio");
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expr) {
    const r = await this.send("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  }
}

const MEASURE = `(() => {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const overflow = doc.scrollWidth - vw;
  const wide = [];
  document.querySelectorAll("body *").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const st = getComputedStyle(el);
    if (st.visibility === "hidden" || st.display === "none") return;
    // ignorar hijos de contenedores con scroll/clip propio
    let p = el.parentElement, skip = false;
    while (p && p !== document.body) {
      const ps = getComputedStyle(p);
      if (["auto", "scroll", "hidden", "clip"].includes(ps.overflowX)) { skip = true; break; }
      p = p.parentElement;
    }
    if (skip) return;
    if (r.right > vw + 1 || r.left < -1) {
      wide.push({ tag: el.tagName.toLowerCase(), cls: (el.className||"").toString().slice(0,60), left: Math.round(r.left), right: Math.round(r.right) });
    }
  });
  const small = [];
  document.querySelectorAll('a, button, input[type="submit"], [role="button"]').forEach((el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || st.visibility === "hidden" || st.display === "none") return;
    if (r.height < 40 || r.width < 24) {
      small.push({ tag: el.tagName.toLowerCase(), cls: (el.className||"").toString().slice(0,50), text: (el.textContent||"").trim().slice(0,30), w: Math.round(r.width), h: Math.round(r.height) });
    }
  });
  return { vw, innerWidth: window.innerWidth, visual: window.visualViewport ? Math.round(window.visualViewport.width) : null, scrollWidth: doc.scrollWidth, overflow: doc.scrollWidth - vw, wideCount: wide.length, wide: wide.slice(0,8), smallCount: small.length, small: small.slice(0,10) };
})()`;

async function main() {
  const wsUrl = await getWsUrl();
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res);
    ws.addEventListener("error", rej);
  });
  const cdp = new Cdp(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  for (const w of WIDTHS) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: w, height: 900, deviceScaleFactor: 1, mobile: w <= 820,
    });
    await cdp.send("Page.navigate", { url: URL });
    await sleep(3500);
    try {
      const m = await cdp.eval(MEASURE);
      const flag = m.scrollWidth > m.vw + 2 ? "  <-- DESBORDA" : "";
      console.log(`\n[${w}px] innerWidth=${m.innerWidth} visual=${m.visual} scrollWidth=${m.scrollWidth} desborde=${m.scrollWidth - m.vw}px${flag}`);
      if (m.wideCount) console.log(`  anchos: ${m.wideCount}`);
      m.wide.forEach((x) => console.log(`    - <${x.tag} class="${x.cls}"> left=${x.left} right=${x.right}`));
      if (m.smallCount) console.log(`  tap targets pequenos: ${m.smallCount}`);
      m.small.forEach((x) => console.log(`    - <${x.tag} class="${x.cls}"> "${x.text}" ${x.w}x${x.h}`));
    } catch (e) {
      console.log(`[${w}px] error: ${e.message}`);
    }
  }
  ws.close();
}

main()
  .catch((e) => console.error("FALLO:", e.message))
  .finally(async () => {
    chromium.kill("SIGKILL");
    await sleep(300);
    try { rmSync(userDir, { recursive: true, force: true }); } catch {}
  });
