import "server-only";
import { DEFAULTS } from "./defaults";

/**
 * ============================================================================
 *  CONFIGURACION DE C-ROTULUS (Next.js)
 * ----------------------------------------------------------------------------
 *  Puerto de app/config.php. Los valores por defecto viven aqui y se pueden
 *  sobrescribir con variables de entorno (en Vercel, Settings > Environment
 *  Variables). Los ajustes guardados en la tabla "settings" tienen prioridad
 *  sobre esto y se aplican en lib/settings.ts (settingsApplyOverrides).
 * ============================================================================
 */

type Dict = Record<string, unknown>;

function env(key: string, fallback = ""): string {
  const v = process.env[key];
  return v === undefined || v === "" ? fallback : v;
}

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

export interface SiteConfig {
  siteName: string;
  siteUrl: string;
  timezone: string;
  db: { driver: string; sslmode: string };
  mail: {
    transport: string;
    fromEmail: string;
    fromName: string;
    toEmail: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    smtpSecure: string;
  };
  google: { clientId: string; clientSecret: string; redirectUri: string };
  sms: {
    provider: string;
    twilioAccountSid: string;
    twilioAuthToken: string;
    twilioFrom: string;
    defaultCountryCode: string;
  };
  security: {
    appKey: string;
    sessionName: string;
    sessionLifetime: number;
    contactRateMax: number;
    contactRateWindow: number;
    loginRateMax: number;
    loginRateWindow: number;
    reviewRateMax: number;
    reviewRateWindow: number;
    submissionRateMax: number;
    submissionRateWindow: number;
    passwordMin: number;
    passwordMax: number;
    captchaTtl: number;
    trustedProxies: string[];
    twoFactorMode: string;
    twoFactorChannelDefault: string;
    twoFactorCodeTtl: number;
    twoFactorMaxAttempts: number;
    twoFactorResendCooldown: number;
    twoFactorTrustDeviceDays: number;
    twoFactorRememberDevice: boolean;
  };
  paths: { logDir: string };
  faq: {
    weightWeight: number;
    weightDemand: number;
    weightChannel: number;
    weightFreshness: number;
    demandThreshold: number;
    freshnessHalflifeDays: number;
    portalMinScore: number;
  };
  defaults: Dict;
}



export function loadConfig(): SiteConfig {
  return {
    siteName: env("APP_SITE_NAME", "C-ROTULUS S.U.R.L."),
    siteUrl: env("APP_SITE_URL", "https://www.c-rotulus.com").replace(/\/+$/, ""),
    timezone: env("TZ", "Europe/Madrid"),
    db: {
      driver: env("DB_DRIVER", "pgsql"),
      sslmode: env("DB_SSLMODE", "require"),
    },
    mail: {
      transport: env("MAIL_TRANSPORT", "smtp"),
      fromEmail: env("MAIL_FROM_EMAIL", ""),
      fromName: env("MAIL_FROM_NAME", "C-ROTULUS"),
      toEmail: env("MAIL_TO", "crotulus.mipyme@gmail.com"),
      smtpHost: env("MAIL_SMTP_HOST", "smtp.gmail.com"),
      smtpPort: envInt("MAIL_SMTP_PORT", 587),
      smtpUser: env("MAIL_SMTP_USER", ""),
      smtpPass: env("MAIL_SMTP_PASS", ""),
      smtpSecure: env("MAIL_SMTP_SECURE", "tls"),
    },
    google: {
      clientId: env("GOOGLE_CLIENT_ID", ""),
      clientSecret: env("GOOGLE_CLIENT_SECRET", ""),
      redirectUri: env("GOOGLE_REDIRECT_URI", ""),
    },
    sms: {
      provider: env("SMS_PROVIDER", "disabled"),
      twilioAccountSid: env("TWILIO_ACCOUNT_SID", ""),
      twilioAuthToken: env("TWILIO_AUTH_TOKEN", ""),
      twilioFrom: env("TWILIO_FROM", ""),
      defaultCountryCode: env("SMS_DEFAULT_COUNTRY_CODE", "+53"),
    },
    security: {
      appKey: env("APP_KEY", "cambia-esta-clave-por-una-larga-y-aleatoria-000"),
      sessionName: env("SESSION_NAME", "crotulus_sid"),
      sessionLifetime: envInt("SESSION_LIFETIME", 60 * 60 * 24 * 30),
      contactRateMax: envInt("CONTACT_RATE_MAX", 5),
      contactRateWindow: envInt("CONTACT_RATE_WINDOW", 3600),
      loginRateMax: envInt("LOGIN_RATE_MAX", 10),
      loginRateWindow: envInt("LOGIN_RATE_WINDOW", 900),
      reviewRateMax: envInt("REVIEW_RATE_MAX", 6),
      reviewRateWindow: envInt("REVIEW_RATE_WINDOW", 3600),
      submissionRateMax: envInt("SUBMISSION_RATE_MAX", 8),
      submissionRateWindow: envInt("SUBMISSION_RATE_WINDOW", 3600),
      passwordMin: envInt("PASSWORD_MIN", 8),
      passwordMax: envInt("PASSWORD_MAX", 200),
      captchaTtl: envInt("CAPTCHA_TTL", 1200),
      trustedProxies: env("TRUSTED_PROXIES", "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      twoFactorMode: env("TWO_FACTOR_MODE", "required"),
      twoFactorChannelDefault: env("TWO_FACTOR_CHANNEL_DEFAULT", "email"),
      twoFactorCodeTtl: envInt("TWO_FACTOR_CODE_TTL", 600),
      twoFactorMaxAttempts: envInt("TWO_FACTOR_MAX_ATTEMPTS", 5),
      twoFactorResendCooldown: envInt("TWO_FACTOR_RESEND_COOLDOWN", 60),
      twoFactorTrustDeviceDays: envInt("TWO_FACTOR_TRUST_DEVICE_DAYS", 30),
      twoFactorRememberDevice: envBool("TWO_FACTOR_REMEMBER_DEVICE", true),
    },
    paths: { logDir: env("LOG_DIR", "") },
    faq: {
      weightWeight: envInt("FAQ_WEIGHT_WEIGHT", 8),
      weightDemand: envInt("FAQ_WEIGHT_DEMAND", 35),
      weightChannel: envInt("FAQ_WEIGHT_CHANNEL", 15),
      weightFreshness: envInt("FAQ_WEIGHT_FRESHNESS", 10),
      demandThreshold: envInt("FAQ_DEMAND_THRESHOLD", 3),
      freshnessHalflifeDays: envInt("FAQ_FRESHNESS_HALFLIFE_DAYS", 180),
      portalMinScore: envInt("FAQ_PORTAL_MIN_SCORE", 20),
    },
    defaults: DEFAULTS,
  };
}

/**
 * Configuracion mutable del proceso. `loadConfig()` devuelve los valores base
 * (env); `settingsApplyOverrides()` los sobrescribe con lo guardado en la BD.
 */
let cached: SiteConfig | null = null;

export function getConfig(): SiteConfig {
  if (!cached) cached = loadConfig();
  return cached;
}

/** Reinicia la cache (util en pruebas). */
export function resetConfig(): void {
  cached = null;
}

/** Valor por defecto editable de una clave de 'defaults'. */
export function defaultSetting(key: string, fallback = ""): string {
  const v = DEFAULTS[key];
  return v === undefined || v === null ? fallback : String(v);
}

export { DEFAULTS };
