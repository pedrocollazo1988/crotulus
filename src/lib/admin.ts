import "server-only";
import { prisma } from "./db";
import { getConfig } from "./config";
import { setting, settingSet, settingsEditable, settingsCheckboxes, settingsSecretKeys } from "./settings";
import { cleanText, sanitizeImagePath, limitText } from "./validator";

/**
 * ============================================================================
 *  SOPORTE DEL PANEL  (puerto de las partes de admin/bootstrap.php y
 *  admin/settings.php que no son presentacion)
 * ============================================================================
 */

/** Contadores para los avisos de la barra de navegacion. */
export async function adminNavCounts(): Promise<Record<string, number>> {
  const [unread, pending, reviews, subs] = await Promise.all([
    prisma.contactMessage.count({ where: { status: "nuevo" } }),
    prisma.user.count({ where: { status: "pending" } }),
    prisma.review.count({ where: { status: "pendiente" } }),
    prisma.userSubmission.count({ where: { status: "pendiente" } }),
  ]);
  return { Mensajes: unread, Usuarios: pending, Valoraciones: reviews, Aportaciones: subs };
}

/** Registro de auditoria (best-effort). */
export async function audit(action: string, data: Record<string, unknown> = {}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { action, data: JSON.stringify(data), createdAt: new Date() },
    });
  } catch {
    // la auditoria nunca debe romper la operacion
  }
}

/* -------------------------------------------------------------------------
 *  SANEADO DE AJUSTES  (espejo de admin/settings.php)
 * ------------------------------------------------------------------------- */

const NUMERIC_KEYS = [
  "faq_portal_count", "mail_smtp_port", "google_reviews_cache_ttl",
  "stat1_value", "stat2_value", "stat3_value", "stat4_value",
  "security_password_min", "security_session_lifetime",
  "security_contact_rate_max", "security_contact_rate_window",
  "security_login_rate_max", "security_login_rate_window",
  "security_review_rate_max", "security_review_rate_window",
  "security_submission_rate_max", "security_submission_rate_window",
  "two_factor_code_ttl", "two_factor_max_attempts",
  "two_factor_resend_cooldown", "two_factor_trust_device_days",
];

const PHONE_KEYS = ["sms_twilio_from", "sms_default_country_code"];

const URL_KEYS = [
  "facebook", "instagram", "linkedin", "github", "google_maps_url",
  "trustpilot_url", "google_reviews_url", "google_redirect_uri", "og_image",
];

const IMAGE_KEYS = ["hero_image", "about_image"];

const SELECT_KEYS: Record<string, string[]> = {
  mail_transport: ["log", "mail", "smtp"],
  mail_smtp_secure: ["tls", "ssl", "none"],
  reviews_provider: ["trustpilot", "google", "custom"],
  two_factor_mode: ["optional", "required", "disabled"],
  two_factor_channel_default: ["email", "sms"],
  sms_provider: ["disabled", "twilio"],
};

/** Limpia un numero de telefono para SMS (deja + y digitos). */
export function sanitizePhone(value: string): string {
  const v = value.trim();
  if (v === "") return "";
  const cleaned = v.replace(/[^\d+]/g, "");
  return /^\+?\d{6,20}$/.test(cleaned) ? cleaned : "";
}

const PLACEHOLDERS = [
  "[URL_FACEBOOK]", "[URL_INSTAGRAM]", "[URL_LINKEDIN]", "[URL_GITHUB]",
  "[TU-DOMINIO]", "[URL_GOOGLE_REVIEWS]", "https://es.trustpilot.com/review/[TU-DOMINIO]",
];

/** Limpia una URL (permite vacio o http/https). */
export function sanitizeUrl(value: string): string {
  const v = value.trim();
  if (v === "" || PLACEHOLDERS.includes(v)) return v;
  return /^https?:\/\/[^\s]+$/i.test(v) ? v : "";
}

/** Saneado del mapa: extrae y valida la URL del iframe o de la URL suelta. */
export function sanitizeMapEmbed(value: string): string {
  const v = value.trim();
  if (v === "") return "";
  const mapsRe = /^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|www\.google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i;
  if (v.toLowerCase().includes("<iframe")) {
    const m = v.match(/src\s*=\s*["']([^"']+)["']/i);
    if (m && mapsRe.test(m[1])) return m[1];
    return "";
  }
  if (/^https?:\/\//i.test(v) && mapsRe.test(v)) return v;
  return "";
}

/**
 * Guarda los ajustes enviados desde un formulario del panel.
 * `scope` es la lista de casillas que ese formulario controla (_checkboxes).
 */
export async function adminSaveSettings(
  form: Record<string, string>,
  scope: string[],
): Promise<void> {
  const checkboxes = settingsCheckboxes();
  const secrets = settingsSecretKeys();

  for (const key of settingsEditable()) {
    if (checkboxes.includes(key)) {
      if (scope.includes(key)) await settingSet(key, form[key] !== undefined ? "1" : "0");
      continue;
    }
    if (!(key in form)) continue;
    let value = form[key];

    // Secretos enmascarados: si el campo no se ha cambiado, se conserva.
    if (secrets.includes(key) && value === "********") continue;

    value = cleanText(value);
    if (NUMERIC_KEYS.includes(key)) {
      value = String(Math.max(0, Number.parseInt(value.replace(/\D/g, "") || "0", 10)));
    } else if (key === "mapa_embed") {
      value = sanitizeMapEmbed(value);
    } else if (key === "trustpilot_business_id") {
      value = value.replace(/[^A-Za-z0-9_-]/g, "");
    } else if (SELECT_KEYS[key]) {
      value = SELECT_KEYS[key].includes(value) ? value : SELECT_KEYS[key][0];
    } else if (IMAGE_KEYS.includes(key)) {
      value = sanitizeImagePath(value);
    } else if (PHONE_KEYS.includes(key)) {
      value = sanitizePhone(value);
    } else if (URL_KEYS.includes(key)) {
      value = sanitizeUrl(value);
    } else if (key === "mail_from_email" || key === "mail_to_email") {
      value = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : "";
    } else if (key === "site_url") {
      value = value.replace(/\/+$/, "");
    }
    await settingSet(key, value);
  }
}

/** Estado del sistema mostrado en la pestana «Rutas». */
export async function adminSystemInfo() {
  return {
    driver: getConfig().db.driver,
    logDir: (await setting("paths_log_dir", "")) || "app/data",
    node: process.version,
  };
}

export { limitText, cleanText };
