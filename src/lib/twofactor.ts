import "server-only";
import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "./db";
import { getConfig } from "./config";
import { appLog } from "./http";
import { mailerTemplate, sendMail } from "./mailer";
import { sendSms, normalizePhone, smsEnabled, smsLastError } from "./sms";
import { generateToken } from "./session";

/**
 * ============================================================================
 *  VERIFICACION EN DOS PASOS (2FA)
 * ----------------------------------------------------------------------------
 *  Tras validar la contrasena, si el usuario tiene la 2FA activa (o es
 *  obligatoria) NO se crea la sesion: se emite un RETO con un codigo de 6
 *  digitos que se envia por correo o por SMS. Solo al introducir el codigo
 *  correcto se abre la sesion.
 *
 *  Medidas de seguridad:
 *   - El codigo NUNCA se guarda en claro (HMAC-SHA256 con la clave de la app).
 *   - Caducidad corta (Ajustes -> Seguridad, por defecto 10 minutos).
 *   - Numero de intentos limitado por reto; al agotarlos el reto se invalida.
 *   - Reenvio con enfriamiento (cooldown) y limite de peticiones por IP.
 *   - El reto va atado a una cookie firmada (challengeHash) que no se puede
 *     adivinar ni reutilizar; se marca como usado al verificar.
 *   - Comparacion en tiempo constante (timing-safe) del codigo.
 *   - Opcion de "recordar este dispositivo" con token hasheado y caducidad.
 * ============================================================================
 */

export type TwoFactorChannel = "email" | "sms";

export interface TwoFactorUser {
  id: number;
  email: string;
  name: string;
  role: string;
  twoFactorEnabled: boolean;
  twoFactorChannel: string;
  twoFactorPhone: string | null;
  twoFactorRequired: boolean;
}

const CHALLENGE_COOKIE = "crotulus_2fa";
const DEVICE_COOKIE = "crotulus_device";

export { CHALLENGE_COOKIE, DEVICE_COOKIE };

/* ---------------------------------------------------------------------------
 *  POLITICA (quien debe usar 2FA y por que canal)
 * ------------------------------------------------------------------------- */

/** true si este usuario debe pasar por la verificacion en dos pasos. */
export function twoFactorRequiredFor(user: TwoFactorUser): boolean {
  const mode = getConfig().security.twoFactorMode;
  if (mode === "disabled") return false;
  if (user.twoFactorRequired) return true;
  if (user.twoFactorEnabled) return true;
  return mode === "required";
}

/**
 * Canal efectivo. Si el usuario eligio SMS pero no hay telefono o el proveedor
 * no esta configurado, se cae a correo (nunca se deja sin segundo factor).
 */
export function twoFactorChannelFor(user: TwoFactorUser): TwoFactorChannel {
  if (user.twoFactorChannel === "sms" && normalizePhone(user.twoFactorPhone ?? "") && smsEnabled()) {
    return "sms";
  }
  return "email";
}

/** Destino (correo o telefono normalizado) para el canal elegido. */
export function twoFactorDestinationFor(user: TwoFactorUser, channel: TwoFactorChannel): string {
  if (channel === "sms") {
    const cfg = getConfig().sms;
    return normalizePhone(user.twoFactorPhone ?? "", cfg.defaultCountryCode);
  }
  return user.email;
}

/** Descripcion enmascarada del destino, para mostrarla sin filtrar datos. */
export function maskDestination(channel: TwoFactorChannel, destination: string): string {
  if (channel === "sms") {
    const tail = destination.slice(-4);
    return `el numero terminado en ${tail}`;
  }
  const [user, domain] = destination.split("@");
  if (!domain) return "tu correo";
  const head = user.length <= 2 ? user[0] ?? "" : user.slice(0, 2);
  return `${head}***@${domain}`;
}

/* ---------------------------------------------------------------------------
 *  RETOS (crear / verificar)
 * ------------------------------------------------------------------------- */

function codeHash(userId: number, code: string): string {
  return createHmac("sha256", getConfig().security.appKey + "|otp").update(`${userId}|${code}`).digest("hex");
}

function challengeHash(token: string): string {
  return createHash("sha256").update(token + "|" + getConfig().security.appKey).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Genera un codigo de 6 digitos (criptograficamente seguro). */
function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export interface StartResult {
  ok: boolean;
  challenge?: string;
  channel?: TwoFactorChannel;
  destination?: string;
  masked?: string;
  error?: string;
  cooldownRemaining?: number;
}

/**
 * Crea un reto (invalida los anteriores) y envia el codigo. Devuelve el token
 * del reto (para la cookie) y datos para la pantalla de verificacion.
 */
export async function startTwoFactorChallenge(
  user: TwoFactorUser,
  ip: string,
  purpose = "login",
): Promise<StartResult> {
  const cfg = getConfig().security;
  const channel = twoFactorChannelFor(user);
  const destination = twoFactorDestinationFor(user, channel);
  if (destination === "") {
    return { ok: false, error: "No hay un destino valido para enviar el codigo. Revisa tus datos de contacto." };
  }

  // Cooldown anti-abuso: evita reenvios seguidos del mismo usuario.
  const since = new Date(Date.now() - cfg.twoFactorResendCooldown * 1000);
  const recent = await prisma.otpCode.findFirst({
    where: { userId: user.id, purpose, createdAt: { gt: since }, usedAt: null },
    orderBy: { id: "desc" },
  });
  if (recent?.createdAt) {
    const elapsed = Math.floor((Date.now() - recent.createdAt.getTime()) / 1000);
    const remaining = cfg.twoFactorResendCooldown - elapsed;
    if (remaining > 0) {
      return {
        ok: false,
        error: `Espera ${remaining} s antes de pedir otro codigo.`,
        cooldownRemaining: remaining,
      };
    }
  }

  // Invalida los retos anteriores de este usuario/proposito.
  await prisma.otpCode.updateMany({
    where: { userId: user.id, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });

  const code = generateCode();
  const token = generateToken(32);
  await prisma.otpCode.create({
    data: {
      userId: user.id,
      purpose,
      codeHash: codeHash(user.id, code),
      challengeHash: challengeHash(token),
      channel,
      destination,
      attempts: 0,
      maxAttempts: cfg.twoFactorMaxAttempts,
      expiresAt: new Date(Date.now() + cfg.twoFactorCodeTtl * 1000),
      ip,
      createdAt: new Date(),
    },
  });

  const delivered = await deliverCode(user, channel, destination, code);
  if (!delivered) {
    await appLog(`two_factor_envio_fallido user=${user.id} channel=${channel}`);
    return {
      ok: false,
      error: channel === "sms"
        ? `No se pudo enviar el SMS${smsLastError() ? ": " + smsLastError() : "."} Intentalo de nuevo o usa el correo.`
        : "No se pudo enviar el correo con el codigo. Revisa la configuracion de correo.",
    };
  }

  return { ok: true, challenge: token, channel, destination, masked: maskDestination(channel, destination) };
}

/** Entrega el codigo por el canal indicado. */
async function deliverCode(
  user: TwoFactorUser,
  channel: TwoFactorChannel,
  destination: string,
  code: string,
): Promise<boolean> {
  const site = getConfig().siteName;
  const minutes = Math.max(1, Math.round(getConfig().security.twoFactorCodeTtl / 60));

  if (channel === "sms") {
    return sendSms(destination, `${code} es tu codigo de verificacion de ${site}. Caduca en ${minutes} min. No lo compartas.`);
  }

  const html = mailerTemplate(
    "Tu codigo de verificacion",
    `<p>Hola ${escapeHtml(user.name || user.email)},</p>
     <p>Tu codigo de verificacion es:</p>
     <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</p>
     <p>Caduca en ${minutes} minutos. Si no has intentado entrar, cambia tu contrasena: alguien conoce tu clave.</p>
     <p>No compartas este codigo con nadie.</p>`,
  );
  return sendMail(destination, `Codigo de verificacion · ${site}`, html, `Tu codigo de verificacion es ${code}`);
}

export interface VerifyResult {
  ok: boolean;
  user?: TwoFactorUser;
  error?: string;
  lockedOut?: boolean;
}

/**
 * Verifica un codigo contra el reto de la cookie. Si es correcto y no ha
 * caducado, consume el reto y devuelve el usuario (para abrir la sesion).
 */
export async function verifyTwoFactorChallenge(
  challengeToken: string,
  code: string,
  purpose = "login",
): Promise<VerifyResult> {
  if (!challengeToken || !/^\d{6}$/.test((code ?? "").trim())) {
    return { ok: false, error: "Escribe el codigo de 6 digitos." };
  }
  const row = await prisma.otpCode.findFirst({
    where: { challengeHash: challengeHash(challengeToken), purpose, usedAt: null },
    orderBy: { id: "desc" },
  });
  if (!row) return { ok: false, error: "La verificacion ha caducado. Vuelve a iniciar sesion." };
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "El codigo ha caducado. Pide uno nuevo." };
  }
  if (row.attempts >= row.maxAttempts) {
    return { ok: false, error: "Se agotaron los intentos. Vuelve a iniciar sesion.", lockedOut: true };
  }

  if (!safeEqual(row.codeHash, codeHash(row.userId, code.trim()))) {
    const attempts = row.attempts + 1;
    const exhausted = attempts >= row.maxAttempts;
    await prisma.otpCode.update({
      where: { id: row.id },
      data: { attempts, ...(exhausted ? { usedAt: new Date() } : {}) },
    });
    return {
      ok: exhausted,
      error: exhausted
        ? "Se agotaron los intentos. Vuelve a iniciar sesion."
        : `Codigo incorrecto. Te quedan ${row.maxAttempts - attempts} intento(s).`,
      lockedOut: exhausted,
    };
  }

  await prisma.otpCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  const dbUser = await prisma.user.findUnique({ where: { id: row.userId } });
  if (!dbUser) return { ok: false, error: "La cuenta ya no existe." };
  return { ok: true, user: toTwoFactorUser(dbUser) };
}

/** Devuelve el usuario de un reto vivo identificado por su token (o null). */
export async function challengeUser(challengeToken: string, purpose = "login"): Promise<TwoFactorUser | null> {
  if (!challengeToken) return null;
  const row = await prisma.otpCode.findFirst({
    where: { challengeHash: challengeHash(challengeToken), purpose, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { id: "desc" },
  });
  if (!row) return null;
  const dbUser = await prisma.user.findUnique({ where: { id: row.userId } });
  return dbUser ? toTwoFactorUser(dbUser) : null;
}

/** Convierte la fila de usuario en la vista que usa la 2FA. */
export function toTwoFactorUser(u: {
  id: number; email: string; name: string; role: string;
  twoFactorEnabled: boolean; twoFactorChannel: string;
  twoFactorPhone: string | null; twoFactorRequired: boolean;
}): TwoFactorUser {
  return {
    id: u.id, email: u.email, name: u.name, role: u.role,
    twoFactorEnabled: u.twoFactorEnabled, twoFactorChannel: u.twoFactorChannel,
    twoFactorPhone: u.twoFactorPhone, twoFactorRequired: u.twoFactorRequired,
  };
}

/* ---------------------------------------------------------------------------
 *  DISPOSITIVOS DE CONFIANZA  ("recordar este dispositivo")
 * ------------------------------------------------------------------------- */

/** true si el token presentado corresponde a un dispositivo de confianza vivo. */
export async function isTrustedDevice(userId: number, deviceToken: string): Promise<boolean> {
  if (!deviceToken) return false;
  const row = await prisma.trustedDevice.findFirst({
    where: { userId, tokenHash: challengeHash(deviceToken) },
  });
  if (!row) return false;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    await prisma.trustedDevice.delete({ where: { id: row.id } });
    return false;
  }
  return true;
}

/** Registra el dispositivo actual como de confianza y devuelve el token. */
export async function trustDevice(
  userId: number,
  ip: string,
  ua: string,
  label = "",
): Promise<string> {
  const days = Math.max(1, getConfig().security.twoFactorTrustDeviceDays);
  const token = generateToken(32);
  await prisma.trustedDevice.create({
    data: {
      userId,
      tokenHash: challengeHash(token),
      label: label.slice(0, 120),
      ip,
      userAgent: ua.slice(0, 255),
      expiresAt: new Date(Date.now() + days * 86400 * 1000),
      createdAt: new Date(),
    },
  });
  return token;
}

/** Revoca todos los dispositivos de confianza del usuario. */
export async function revokeTrustedDevices(userId: number): Promise<void> {
  await prisma.trustedDevice.deleteMany({ where: { userId } });
}

/* ---------------------------------------------------------------------------
 *  LIMPIEZA
 * ------------------------------------------------------------------------- */

/** Borra retos caducados (best-effort). */
export async function pruneOtpCodes(): Promise<void> {
  try {
    await prisma.otpCode.deleteMany({
      where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { lt: new Date(Date.now() - 86400_000) } }] },
    });
  } catch {
    /* silencioso */
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
