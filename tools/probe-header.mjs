/**
 * Geometria de la cabecera a varios anchos. Uso: node tools/probe-header.mjs <url>
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const URL = process.argv[2] || "https://crotulus.vercel.app/index.html";
const WIDTHS = [1200, 1280, 1310, 1366, 1440];
const PORT = 9335;
const userDir = mkdtempSync(path.join(tmpdir(), "cdp-hdr-"));
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

const PROBE = `(() => {
  const q = (s) => document.querySelector(s);
  const w = (s) => { const e = q(s); return e ? Math.round(e.getBoundingClientRect().width) : null; };
  const r = (s) => { const e = q(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; };
  const inner = q(".site-header__inner");
  const ist = inner ? getComputedStyle(inner) : null;
  return {
    vw: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    container: w(".site-header__inner"),
    cols: ist ? ist.gridTemplateColumns : null,
    brand: w(".brand"),
    nav: w(".primary-nav"),
    navList: w(".primary-nav__list"),
    actions: w(".site-header__actions"),
    navLinks: document.querySelectorAll(".primary-nav__list .nav-link").length,
    actionsRange: r(".site-header__actions"),
  };
})()`;

const main = async () => {
  const sock = new WebSocket(await wsUrl());
  await new Promise((res, rej) => { sock.addEventListener("open", res); sock.addEventListener("error", rej); });
  let id = 0; const pend = new Map();
  sock.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const { resolve, reject } = pend.get(m.id); pend.delete(m.id); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); }
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { resolve: res, reject: rej }); sock.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable"); await send("Runtime.enable");
  for (const w of WIDTHS) {
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: URL });
    await sleep(3000);
    const r = await send("Runtime.evaluate", { expression: PROBE, returnByValue: true });
    const v = r.result.value;
    console.log(`\n[${w}] scrollW=${v.scrollWidth}${v.scrollWidth > w ? " DESBORDA+" + (v.scrollWidth - w) : ""} inner=${v.container} brand=${v.brand} nav=${v.nav} actions=${v.actions} links=${v.navLinks} actionsRange=${JSON.stringify(v.actionsRange)}`);
    console.log(`   cols=${v.cols}`);
  }
  sock.close();
};

main().catch((e) => console.error("FALLO:", e.message)).finally(async () => {
  chromium.kill("SIGKILL"); await sleep(300);
  try { rmSync(userDir, { recursive: true, force: true }); } catch {}
});
