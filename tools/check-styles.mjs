/**
 * Comprueba los estilos calculados de una pagina (util para confirmar que el CSS
 * minificado se aplica igual). Uso: node tools/check-styles.mjs <url> <sel1,sel2,..>
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const URL = process.argv[2];
const SELECTORS = (process.argv[3] || "body").split(",");
const PORT = 9341;
const userDir = mkdtempSync(path.join(tmpdir(), "cdp-sty-"));
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
  let id = 0; const pend = new Map();
  sock.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const { resolve, reject } = pend.get(m.id); pend.delete(m.id); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); }
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { resolve: res, reject: rej }); sock.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: URL });
  await sleep(3500);
  const expr = `(() => {
    const sels = ${JSON.stringify(SELECTORS)};
    const props = ["borderRadius", "boxShadow", "backgroundColor", "backgroundImage", "display", "padding"];
    const sheets = [...document.styleSheets].map(x => x.href).filter(Boolean).map(h => h.replace(/^https?:\\/\\/[^/]+/, ""));
    let rules = 0;
    for (const sh of document.styleSheets) { try { rules += sh.cssRules.length; } catch {} }
    const rows = sels.map(sel => {
      const e = document.querySelector(sel);
      if (!e) return sel + " -> ausente";
      const st = getComputedStyle(e);
      return sel + " -> " + props.map(p => p + "=" + String(st[p]).slice(0, 40)).join(", ");
    });
    return { sheets, rules, rows };
  })()`;
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  const v = r.result.value;
  console.log("hojas:", v.sheets.join(", "));
  console.log("reglas CSS:", v.rules);
  v.rows.forEach((x) => console.log("  " + x));
  sock.close();
};

main().catch((e) => console.error("FALLO:", e.message)).finally(async () => {
  chromium.kill("SIGKILL"); await sleep(300);
  try { rmSync(userDir, { recursive: true, force: true }); } catch {}
});
