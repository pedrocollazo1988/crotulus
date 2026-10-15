import "server-only";
import { prisma } from "./db";
import { setting, settingSet } from "./settings";
import { appLog } from "./http";
import { createHash } from "node:crypto";

/**
 * ============================================================================
 *  TRUSTPILOT  (puerto de las funciones trustpilot_* de app/lib/reviews.php)
 * ----------------------------------------------------------------------------
 *  Trustpilot devuelve 403 (Cloudflare) a peticiones de servidor, asi que la
 *  via fiable es el widget oficial (TrustBox). Esta descarga JSON-LD es
 *  best-effort y cachea 6 h en settings.
 * ============================================================================
 */

/** Dominio resenable de la URL de Trustpilot (o ''). */
export async function trustpilotDomain(): Promise<string> {
  const url = (await setting("trustpilot_url", "")).trim();
  if (url === "" || url.includes("[") || !/^https?:\/\//.test(url)) return "";
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/");
    const domain = (parts[parts.length - 1] ?? "").replace(/[^A-Za-z0-9.-]/g, "");
    return domain;
  } catch {
    return "";
  }
}

/** ¿Esta configurada la integracion con Trustpilot? */
export async function trustpilotEnabled(): Promise<boolean> {
  return (await setting("reviews_provider", "custom")) === "trustpilot" && (await trustpilotDomain()) !== "";
}

const EMPTY = {
  ok: false,
  source: "trustpilot",
  summary: { total: 0, average: 0, stars: 0, trustscore: 0 },
  items: [] as unknown[],
};

/** Descarga las resenas publicas (con cache de 6 h). */
export async function trustpilotFetch(force = false) {
  const domain = await trustpilotDomain();
  if (domain === "") return { ...EMPTY };

  const cacheKey = "trustpilot_cache_" + createHash("md5").update(domain).digest("hex");
  const cacheTtl = 6 * 3600;

  if (!force) {
    const cached = await prisma.setting.findUnique({ where: { skey: cacheKey } });
    if (cached && cached.updatedAt && Date.now() - cached.updatedAt.getTime() < cacheTtl * 1000) {
      try {
        const decoded = JSON.parse(cached.svalue ?? "");
        if (decoded && typeof decoded === "object") {
          decoded.cached = true;
          return decoded;
        }
      } catch {
        // cache corrupta: seguimos
      }
    }
  }

  let html = "";
  let status = 0;
  try {
    const res = await fetch(`https://es.trustpilot.com/review/${encodeURIComponent(domain)}`, {
      headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0 (compatible; C-ROTULUS/1.0)" },
    });
    status = res.status;
    html = await res.text();
  } catch {
    status = 0;
  }

  if (status !== 200 || html === "") {
    await appLog(`Trustpilot: respuesta ${status} para ${domain}`);
    return { ...EMPTY };
  }

  const data = trustpilotParse(html);
  if (data.summary.total === 0) {
    await appLog(`Trustpilot: sin resenas en el HTML de ${domain}`);
    return { ...EMPTY };
  }

  await settingSet(cacheKey, JSON.stringify(data));
  return { ...data, cached: false };
}

/** Extrae la nota media, el TrustScore y las resenas del HTML publico (JSON-LD). */
export function trustpilotParse(html: string) {
  const summary = { total: 0, average: 0, stars: 0, trustscore: 0 };
  const items: Record<string, unknown>[] = [];

  const scriptRe = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(html)) !== null) {
    let json: unknown;
    try {
      json = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const nodes = Array.isArray(json) ? json : [json];
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const n = node as Record<string, unknown>;
      if (n["@type"] !== "LocalBusiness") continue;

      const agg = n["aggregateRating"] as Record<string, unknown> | undefined;
      if (agg) {
        summary.total = Number(agg["ratingCount"] ?? agg["reviewCount"] ?? 0);
        summary.average = Math.round(Number(agg["ratingValue"] ?? 0) * 10) / 10;
        summary.stars = Math.round(summary.average);
      }
      for (const prop of (n["additionalProperty"] ?? []) as Record<string, unknown>[]) {
        if (prop["name"] === "TrustScore") summary.trustscore = Number(prop["value"] ?? 0);
      }
      for (const rev of (n["review"] ?? []) as Record<string, unknown>[]) {
        const rr = (rev["reviewRating"] ?? {}) as Record<string, unknown>;
        items.push({
          author_name: String((rev["author"] as Record<string, unknown>)?.["name"] ?? "Cliente"),
          rating: Math.round(Number(rr["ratingValue"] ?? 5)),
          comment: String(rev["reviewBody"] ?? rev["description"] ?? "").trim(),
          title: String(rev["headline"] ?? rev["name"] ?? "").trim(),
          created_at: String(rev["datePublished"] ?? ""),
          url: String(n["url"] ?? ""),
        });
      }
    }
  }

  if (summary.trustscore === 0) {
    const ts = html.match(/"trustScore"\s*:\s*([0-9.]+)/);
    if (ts) summary.trustscore = Number(ts[1]);
  }

  return { ok: summary.total > 0, source: "trustpilot", summary, items };
}
