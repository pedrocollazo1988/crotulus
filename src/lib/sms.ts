import "server-only";
import { getConfig } from "./config";
import { appLog } from "./http";

/**
 * ============================================================================
 *  ENVIO DE SMS
 * ----------------------------------------------------------------------------
 *  Proveedor Twilio por HTTP (fetch), sin dependencias externas: funciona en
 *  Vercel/Node sin instalar nada. El proveedor y las credenciales se guardan en
 *  Ajustes -> Seguridad (tabla settings, tienen prioridad) o en variables de
 *  entorno (SMS_PROVIDER, TWILIO_*).
 * ============================================================================
 */

export function smsEnabled(): boolean {
  const cfg = getConfig().sms;
  return cfg.provider === "twilio" && cfg.twilioAccountSid !== "" && cfg.twilioAuthToken !== "" && cfg.twilioFrom !== "";
}

/** true si el proveedor configurado esta listo para enviar. */
export function smsProviderReady(): boolean {
  return smsEnabled();
}

let lastError = "";

export function smsLastError(): string {
  return lastError;
}

/**
 * Normaliza un numero a formato E.164. Si no lleva prefijo internacional se le
 * antepone el codigo por defecto (Ajustes -> Seguridad; por defecto Cuba +53).
 * Devuelve "" si no es un numero valido.
 */
export function normalizePhone(raw: string, countryCode = ""): string {
  let v = (raw ?? "").trim();
  if (v === "") return "";
  v = v.replace(/[^\d+]/g, "");
  if (v.startsWith("00")) v = "+" + v.slice(2);
  if (!v.startsWith("+")) {
    const cc = (countryCode || "").replace(/[^\d+]/g, "").replace(/^\+?/, "+").replace(/\++/g, "+");
    v = `${cc}${v.replace(/^0+/, "")}`;
  }
  return /^\+[1-9]\d{6,14}$/.test(v) ? v : "";
}

/**
 * Envia un SMS. Devuelve true si el proveedor lo acepto. El motivo del fallo
 * queda en smsLastError().
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
  lastError = "";
  const cfg = getConfig().sms;

  if (!smsEnabled()) {
    lastError = "El envio de SMS no esta configurado (proveedor o credenciales).";
    await appLog(lastError);
    return false;
  }

  const auth = Buffer.from(`${cfg.twilioAccountSid}:${cfg.twilioAuthToken}`).toString("base64");
  const params = new URLSearchParams({ From: cfg.twilioFrom, To: to, Body: body });

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.twilioAccountSid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      lastError = `Twilio respondio ${res.status}: ${text.slice(0, 300)}`;
      await appLog(lastError);
      return false;
    }
    return true;
  } catch (err) {
    lastError = `Fallo al enviar el SMS: ${err instanceof Error ? err.message : String(err)}`;
    await appLog(lastError);
    return false;
  }
}
