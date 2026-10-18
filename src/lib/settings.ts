import "server-only";
import { prisma } from "./db";
import { getConfig, defaultSetting, DEFAULTS } from "./config";

/**
 * ============================================================================
 *  AJUSTES DEL SITIO  (puerto de app/lib/settings.php)
 *  Clave/valor en la tabla "settings"; los usa el panel y la API publica.
 * ============================================================================
 */

/** Todos los ajustes como objeto plano (string -> string). */
export async function settingsAll(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({ select: { skey: true, svalue: true } });
  const out: Record<string, string> = {};
  for (const row of rows) out[row.skey] = row.svalue ?? "";
  const all: Record<string, string> = { ...stringifyDefaults(), ...out };
  all["site_name"] = out["site_name"] ?? getConfig().siteName;
  all["site_url"] = out["site_url"] ?? getConfig().siteUrl;
  return all;
}

/** Devuelve un ajuste concreto (primero la BD, luego los defaults). */
export async function setting(key: string, fallback = ""): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { skey: key }, select: { svalue: true } });
  if (row) return row.svalue ?? "";
  return defaultSetting(key, fallback);
}

/** Guarda (o crea) un ajuste. */
export async function settingSet(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { skey: key },
    create: { skey: key, svalue: value, updatedAt: new Date() },
    update: { svalue: value, updatedAt: new Date() },
  });
}

/** Ajustes editables desde el panel (lista blanca). */
export function settingsEditable(): string[] {
  return [
    "telefono", "whatsapp", "correo", "direccion", "ciudad", "horario",
    "mapa_embed", "google_maps_url",
    "facebook", "instagram", "linkedin", "github",
    "reviews_enabled", "reviews_auto_approve", "reviews_provider",
    "testimonials_enabled", "google_reviews_enabled", "trustpilot_enabled",
    "testimonials_form_enabled",
    "trustpilot_url", "trustpilot_business_id", "trustpilot_template",
    "google_reviews_url", "google_place_id", "google_places_api_key",
    "google_reviews_cache_ttl",
    "submissions_enabled", "submissions_auto_approve", "faq_portal_count",
    "site_name", "site_url", "meta_description", "meta_keywords", "og_image",
    "hero_badge", "hero_title", "hero_title_accent", "hero_subtitle",
    "hero_cta1_label", "hero_cta2_label", "hero_image", "hero_image_alt",
    "stat1_value", "stat1_label", "stat2_value", "stat2_label",
    "stat3_value", "stat3_label", "stat4_value", "stat4_label",
    "about_eyebrow", "about_title", "about_lead", "about_body",
    "about_image", "about_image_alt",
    "team_eyebrow", "team_title", "team_lead",
    "services_eyebrow", "services_title", "services_lead",
    "projects_eyebrow", "projects_title", "projects_lead",
    "blog_eyebrow", "blog_title", "blog_lead",
    "process_eyebrow", "process_title", "process_lead",
    "testimonials_eyebrow", "testimonials_title", "testimonials_lead",
    "reviews_eyebrow", "reviews_title", "reviews_lead",
    "trustpilot_eyebrow", "trustpilot_title", "trustpilot_lead",
    "contact_eyebrow", "contact_title", "contact_lead",
    "location_eyebrow", "location_title", "location_lead",
    "faq_eyebrow", "faq_title", "faq_lead",
    "footer_tagline", "footer_legal",
    "mail_transport", "mail_from_email", "mail_from_name", "mail_to_email",
    "mail_smtp_host", "mail_smtp_port", "mail_smtp_user", "mail_smtp_pass",
    "mail_smtp_secure",
    "security_password_min", "security_session_lifetime",
    "email_verification",
    "security_contact_rate_max", "security_contact_rate_window",
    "security_login_rate_max", "security_login_rate_window",
    "security_review_rate_max", "security_review_rate_window",
    "security_submission_rate_max", "security_submission_rate_window",
    "security_session_bind_ip",
    "google_client_id", "google_client_secret", "google_redirect_uri",
    "two_factor_mode", "two_factor_channel_default", "two_factor_code_ttl",
    "two_factor_max_attempts", "two_factor_resend_cooldown",
    "two_factor_trust_device_days", "two_factor_remember_device",
    "sms_provider", "sms_twilio_account_sid", "sms_twilio_auth_token",
    "sms_twilio_from", "sms_default_country_code",
    "paths_log_dir", "maintenance_mode", "maintenance_message",
  ];
}

/** Casillas de verificacion: se guardan siempre como '1' o '0'. */
export function settingsCheckboxes(): string[] {
  return [
    "reviews_enabled", "reviews_auto_approve",
    "testimonials_enabled", "google_reviews_enabled", "trustpilot_enabled",
    "testimonials_form_enabled",
    "submissions_enabled", "submissions_auto_approve",
    "security_session_bind_ip", "maintenance_mode",
    "two_factor_remember_device",
  ];
}

/** Claves sensibles: se guardan pero se muestran enmascaradas en el panel. */
export function settingsSecretKeys(): string[] {
  return ["google_client_secret", "mail_smtp_pass", "google_places_api_key", "sms_twilio_auth_token"];
}

/** Claves que NUNCA se exponen en la API publica. */
export function settingsPrivateKeys(): string[] {
  return settingsSecretKeys();
}

const MASK = "********";

/** Enmascara los valores secretos para el panel. */
export function settingsMaskSecrets(all: Record<string, string>): Record<string, string> {
  const out = { ...all };
  for (const key of settingsSecretKeys()) {
    if (out[key]) out[key] = MASK;
  }
  return out;
}

/** true si el valor enviado es la mascara (no se debe sobrescribir). */
export function settingsIsMask(value: string): boolean {
  return value === MASK;
}

/** Mapa: clave de "settings" -> ruta de config. */
export function settingsConfigMap(): Record<string, string> {
  return {
    site_name: "siteName",
    site_url: "siteUrl",
    mail_transport: "mail.transport",
    mail_from_email: "mail.fromEmail",
    mail_from_name: "mail.fromName",
    mail_to_email: "mail.toEmail",
    mail_smtp_host: "mail.smtpHost",
    mail_smtp_port: "mail.smtpPort",
    mail_smtp_user: "mail.smtpUser",
    mail_smtp_pass: "mail.smtpPass",
    mail_smtp_secure: "mail.smtpSecure",
    security_password_min: "security.passwordMin",
    email_verification: "security.emailVerification",
    security_session_lifetime: "security.sessionLifetime",
    security_session_bind_ip: "security.sessionBindIp",
    security_contact_rate_max: "security.contactRateMax",
    security_contact_rate_window: "security.contactRateWindow",
    security_login_rate_max: "security.loginRateMax",
    security_login_rate_window: "security.loginRateWindow",
    security_review_rate_max: "security.reviewRateMax",
    security_review_rate_window: "security.reviewRateWindow",
    security_submission_rate_max: "security.submissionRateMax",
    security_submission_rate_window: "security.submissionRateWindow",
    google_client_id: "google.clientId",
    google_client_secret: "google.clientSecret",
    google_redirect_uri: "google.redirectUri",
    sms_provider: "sms.provider",
    sms_twilio_account_sid: "sms.twilioAccountSid",
    sms_twilio_auth_token: "sms.twilioAuthToken",
    sms_twilio_from: "sms.twilioFrom",
    sms_default_country_code: "sms.defaultCountryCode",
    two_factor_mode: "security.twoFactorMode",
    two_factor_channel_default: "security.twoFactorChannelDefault",
    two_factor_code_ttl: "security.twoFactorCodeTtl",
    two_factor_max_attempts: "security.twoFactorMaxAttempts",
    two_factor_resend_cooldown: "security.twoFactorResendCooldown",
    two_factor_trust_device_days: "security.twoFactorTrustDeviceDays",
    two_factor_remember_device: "security.twoFactorRememberDevice",
    paths_log_dir: "paths.logDir",
  };
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let ref: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof ref[part] !== "object" || ref[part] === null) ref[part] = {};
    ref = ref[part] as Record<string, unknown>;
  }
  ref[parts[parts.length - 1]] = value;
}

const CAST_INT = new Set([
  "mail.smtpPort",
  "security.passwordMin", "security.sessionLifetime",
  "security.contactRateMax", "security.contactRateWindow",
  "security.loginRateMax", "security.loginRateWindow",
  "security.reviewRateMax", "security.reviewRateWindow",
  "security.submissionRateMax", "security.submissionRateWindow",
  "security.twoFactorCodeTtl", "security.twoFactorMaxAttempts",
  "security.twoFactorResendCooldown", "security.twoFactorTrustDeviceDays",
]);

const CAST_BOOL = new Set([
  "security.sessionBindIp", "security.twoFactorRememberDevice",
]);

/**
 * Sobrescribe la configuracion en memoria con los valores guardados en la BD.
 * Se llama al inicio de cada peticion (ver src/lib/bootstrap.ts).
 */
export async function settingsApplyOverrides(config: Record<string, unknown>): Promise<void> {
  let rows: { skey: string; svalue: string | null }[];
  try {
    rows = await prisma.setting.findMany({ select: { skey: true, svalue: true } });
  } catch {
    return; // Sin tabla de ajustes todavia.
  }
  const map = settingsConfigMap();
  for (const row of rows) {
    const key = row.skey;
    const path = map[key];
    if (!path) continue;
    const value = row.svalue ?? "";
    // Un valor vacio en la BD NO pisa la variable de entorno. La semilla
    // siembra en blanco "mail_smtp_pass", "google_places_api_key",
    // "mail_from_email", "sms_twilio_account_sid", "sms_twilio_from" o
    // "paths_log_dir": si el vacio ganara, MAIL_SMTP_PASS (correo 535
    // BadCredentials) o TWILIO_ACCOUNT_SID de Vercel se perderian sin aviso.
    // Misma semantica que el panel (vacio = conservar). Ver adminSaveSettings().
    if (value === "") continue;
    if (CAST_BOOL.has(path)) {
      setPath(config, path, value === "1");
    } else if (CAST_INT.has(path)) {
      setPath(config, path, Number.parseInt(value, 10) || 0);
    } else {
      setPath(config, path, value);
    }
  }
}

/** Datos publicos que expone la web (subconjunto seguro de ajustes). */
export function settingsPublicAllowList(): string[] {
  return [
    "telefono", "whatsapp", "correo", "direccion", "ciudad", "horario",
    "mapa_embed", "google_maps_url",
    "facebook", "instagram", "linkedin", "github",
    "reviews_enabled", "reviews_auto_approve", "reviews_provider",
    "testimonials_enabled", "google_reviews_enabled", "trustpilot_enabled",
    "testimonials_form_enabled",
    "trustpilot_url", "trustpilot_business_id", "trustpilot_template",
    "google_reviews_url", "google_place_id",
    "submissions_enabled", "submissions_auto_approve", "faq_portal_count",
    "site_name", "site_url", "meta_description",
    "maintenance_mode", "maintenance_message",
    "hero_badge", "hero_title", "hero_title_accent", "hero_subtitle",
    "hero_cta1_label", "hero_cta2_label", "hero_image", "hero_image_alt",
    "stat1_value", "stat1_label", "stat2_value", "stat2_label",
    "stat3_value", "stat3_label", "stat4_value", "stat4_label",
    "about_eyebrow", "about_title", "about_lead", "about_body",
    "about_image", "about_image_alt",
    "team_eyebrow", "team_title", "team_lead",
    "services_eyebrow", "services_title", "services_lead",
    "projects_eyebrow", "projects_title", "projects_lead",
    "blog_eyebrow", "blog_title", "blog_lead",
    "process_eyebrow", "process_title", "process_lead",
    "testimonials_eyebrow", "testimonials_title", "testimonials_lead",
    "reviews_eyebrow", "reviews_title", "reviews_lead",
    "trustpilot_eyebrow", "trustpilot_title", "trustpilot_lead",
    "contact_eyebrow", "contact_title", "contact_lead",
    "location_eyebrow", "location_title", "location_lead",
    "faq_eyebrow", "faq_title", "faq_lead",
    "footer_tagline", "footer_legal",
  ];
}

/** Ajustes publicos (subconjunto seguro). */
export async function settingsPublic(): Promise<Record<string, string>> {
  const all = await settingsAll();
  const out: Record<string, string> = {};
  for (const key of settingsPublicAllowList()) {
    if (key in all) out[key] = all[key];
  }
  return out;
}

function stringifyDefaults(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(DEFAULTS)) out[k] = String(v);
  return out;
}
