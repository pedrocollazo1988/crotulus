/**
 * Captura de pantalla completa. Uso: node tools/shot.mjs <url> <out.png> <width>
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const [url, out, wArg] = process.argv.slice(2);
const W = parseInt(wArg || "1440", 10);
const PORT = 9337;
const userDir = mkdtempSync(path.join(tmpdir(), "cdp-shot-"));
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
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: 900, deviceScaleFactor: 1, mobile: W <= 820 });
  await send("Page.navigate", { url });
  await sleep(3500);
  await send("Runtime.evaluate", { expression: `(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 150)); }
    window.scrollTo(0, 0);
    document.querySelectorAll('.reveal').forEach(e => e.classList.add('is-visible'));
    document.documentElement.classList.remove('has-reveal-anim');
  })()`, awaitPromise: true });
  await sleep(1500);
  const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(out, Buffer.from(r.data, "base64"));
  console.log("guardado", out);
  sock.close();
};

main().catch((e) => console.error("FALLO:", e.message)).finally(async () => {
  chromium.kill("SIGKILL"); await sleep(300);
  try { rmSync(userDir, { recursive: true, force: true }); } catch {}
});
