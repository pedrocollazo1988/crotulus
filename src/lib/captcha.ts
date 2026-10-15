import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { getConfig } from "./config";

/**
 * ============================================================================
 *  CAPTCHA PROPIO (puerto de app/lib/captcha.php)
 *  Reto aritmetico firmado con HMAC y con caducidad. Sin dependencias externas.
 * ============================================================================
 */

export interface CaptchaChallenge {
  challenge: string;
  token: string;
}

/** Devuelve un reto nuevo: { challenge: '7 + 5 = ?', token: '...' }. */
export function captchaIssue(): CaptchaChallenge {
  const a = randomInt(2, 10);
  const b = randomInt(2, 10);

  let question: string;
  let answer: number;
  if (randomInt(0, 2) === 0) {
    question = `${a} + ${b}`;
    answer = a + b;
  } else {
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    question = `${hi} - ${lo}`;
    answer = hi - lo;
  }

  return { challenge: `${question} = ?`, token: captchaSign(answer) };
}

/** Firma la respuesta con HMAC y le anade la marca de tiempo. */
function captchaSign(answer: number): string {
  const ts = Math.floor(Date.now() / 1000);
  const key = getConfig().security.appKey;
  const mac = createHmac("sha256", key + "|captcha").update(`${answer}|${ts}`).digest("hex");
  return `${ts}.${mac}`;
}

/** Comprueba la respuesta del usuario contra la firma. */
export function captchaVerify(token: string, given: string): boolean {
  const t = (token ?? "").trim();
  const g = (given ?? "").trim();
  if (t === "" || g === "" || !/^-?\d+$/.test(g)) return false;

  const parts = t.split(".");
  if (parts.length !== 2) return false;
  const [ts, mac] = parts;
  if (!/^\d+$/.test(ts)) return false;

  const ttl = getConfig().security.captchaTtl;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(ts)) > ttl) return false;

  const key = getConfig().security.appKey;
  const expected = createHmac("sha256", key + "|captcha")
    .update(`${Number.parseInt(g, 10)}|${Number.parseInt(ts, 10)}`)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(mac);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
