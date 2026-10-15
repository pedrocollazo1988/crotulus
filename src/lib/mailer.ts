import "server-only";
import nodemailer from "nodemailer";
import { getConfig } from "./config";
import { appLog, logDir } from "./http";
import { setting } from "./settings";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * ============================================================================
 *  ENVIO DE CORREO  (puerto de app/lib/mailer.php)
 *  Modos: 'smtp' (Nodemailer), 'mail' (no disponible en Node -> log) y 'log'.
 * ============================================================================
 */

let lastError = "";

export function mailerLastError(): string {
  return lastError;
}

/** Correo que recibe los avisos (Ajustes -> config). */
export async function mailNotifyTo(): Promise<string> {
  const candidates = [getConfig().mail.toEmail, await setting("correo", "")];
  for (const c of candidates) {
    const v = (c ?? "").trim();
    if (v !== "" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return v;
  }
  return "";
}

/** Correo remitente efectivo (si no hay from, se usa el usuario SMTP). */
function mailerFromEmail(): string {
  const cfg = getConfig().mail;
  if (cfg.fromEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.fromEmail)) return cfg.fromEmail;
  if (cfg.smtpUser && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.smtpUser)) return cfg.smtpUser;
  return "no-reply@localhost";
}

/** Plantilla HTML basica para los correos transaccionales. */
export function mailerTemplate(title: string, content: string): string {
  const site = getConfig().siteName;
  const year = new Date().getFullYear();
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:Arial,Helvetica,sans-serif;background:#F4F8FB;margin:0;padding:24px;color:#17303F}
.card{max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(11,46,69,.08)}
.head{background:#136493;color:#fff;padding:20px 24px;font-size:18px;font-weight:700}
.body{padding:24px;line-height:1.6}.btn{display:inline-block;background:#136493;color:#fff!important;
text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600}
.foot{padding:16px 24px;font-size:12px;color:#4F6474;border-top:1px solid #DDE7EE}</style></head><body>
<div class="card"><div class="head">${site}</div><div class="body">
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>${content}</div>
<div class="foot">&copy; ${year} ${site}</div></div></body></html>`;
}

/**
 * Envia un correo. Devuelve true si se entrego/encolo correctamente.
 * $replyTo permite responder directamente al cliente.
 */
export async function sendMail(
  to: string,
  subject: string,
  htmlBody: string,
  textBody = "",
  replyTo = "",
): Promise<boolean> {
  const cfg = getConfig().mail;
  const transport = cfg.transport || "log";
  lastError = "";

  const text = textBody || stripTags(htmlBody);

  if (transport === "log" || transport === "mail") {
    // 'mail' (funcion mail() de PHP) no existe en Node: cae a 'log'.
    try {
      const dir = logDir();
      await mkdir(dir, { recursive: true });
      const line = `[${new Date().toISOString()}] TO:${to} | FROM:${mailerFromEmail()} | SUBJECT:${subject}\n${"-".repeat(40)}\n${text}\n\n`;
      await appendFile(path.join(dir, "mail.log"), line);
      return true;
    } catch (err) {
      lastError = `No se pudo escribir el log de correo: ${String(err)}`;
      await appLog(lastError);
      return false;
    }
  }

  // SMTP con Nodemailer.
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      secure: cfg.smtpSecure === "ssl",
      auth: cfg.smtpUser ? { user: cfg.smtpUser, pass: cfg.smtpPass } : undefined,
      requireTLS: cfg.smtpSecure === "tls",
    });

    await transporter.sendMail({
      from: `"${cfg.fromName}" <${mailerFromEmail()}>`,
      to,
      subject,
      html: htmlBody,
      text,
      ...(replyTo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo) ? { replyTo } : {}),
    });
    return true;
  } catch (err) {
    lastError = `Fallo SMTP: ${err instanceof Error ? err.message : String(err)}`;
    await appLog(lastError);
    return false;
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
