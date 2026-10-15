import "server-only";
import { prisma } from "./db";
import { setting, settingSet } from "./settings";

/**
 * ============================================================================
 *  RESEÑAS DE GOOGLE EN VIVO CON CACHE  (puerto de app/lib/google_reviews.php)
 * ----------------------------------------------------------------------------
 *  Consulta Google Places API (plan gratuito) y cachea el resultado en la
 *  tabla google_reviews. Si no hay conexion, devuelve las ultimas guardadas.
 * ============================================================================
 */

interface GoogleReviewItem {
  author_name: string;
  rating: number;
  comment: string;
  relative_time: string;
  photo: string;
  profile_url: string;
  time: number;
}

export async function googleReviewsPlaceId(): Promise<string> {
  return (await setting("google_place_id", "")).trim();
}

export async function googleReviewsApiKey(): Promise<string> {
  return (await setting("google_places_api_key", "")).trim();
}

export async function googleReviewsEnabled(): Promise<boolean> {
  return (await googleReviewsPlaceId()) !== "" && (await googleReviewsApiKey()) !== "";
}

export async function googleReviewsTtl(): Promise<number> {
  const ttl = Number.parseInt(await setting("google_reviews_cache_ttl", "21600"), 10);
  return ttl > 0 ? ttl : 21600;
}

/** Ultimas resenas guardadas (respaldo sin conexion). */
export async function googleReviewsCached(limit = 3) {
  const take = Math.max(1, Math.min(20, limit));
  const rows = await prisma.googleReview.findMany({
    orderBy: [{ sortTs: "desc" }, { id: "desc" }],
    take,
  });
  return rows.map((r) => ({
    author_name: r.author ?? "",
    rating: r.rating,
    comment: r.body ?? "",
    relative_time: r.relativeTime ?? "",
    photo: r.photo ?? "",
    profile_url: r.profileUrl ?? "",
    created_at: r.sortTs,
  }));
}

/** Nota media y total cacheados. */
export async function googleReviewsSummaryCached() {
  const raw = await setting("google_reviews_summary", "");
  let dec: Record<string, unknown> | null = null;
  try {
    dec = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    dec = null;
  }
  if (!dec) dec = { average: 0, total: 0, stars: 0 };
  return {
    average: Number(dec["average"] ?? 0),
    total: Number(dec["total"] ?? 0),
    stars: Number(dec["stars"] ?? 0),
  };
}

/** Consulta la API de Google Places. */
async function googleReviewsRequest(): Promise<{
  ok: boolean;
  items: GoogleReviewItem[];
  summary: { average: number; total: number; stars: number };
  error: string | null;
}> {
  const place = await googleReviewsPlaceId();
  const key = await googleReviewsApiKey();
  if (place === "" || key === "") {
    return { ok: false, items: [], summary: { average: 0, total: 0, stars: 0 }, error: "sin_configurar" };
  }

  const url =
    "https://maps.googleapis.com/maps/api/place/details/json" +
    `?place_id=${encodeURIComponent(place)}` +
    `&fields=${encodeURIComponent("name,rating,user_ratings_total,reviews")}` +
    "&language=es&reviews_sort=newest" +
    `&key=${encodeURIComponent(key)}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    return { ok: false, items: [], summary: { average: 0, total: 0, stars: 0 }, error: "sin_conexion" };
  }
  if (!res.ok) {
    return { ok: false, items: [], summary: { average: 0, total: 0, stars: 0 }, error: "sin_conexion" };
  }

  const data = (await res.json()) as Record<string, unknown>;
  if (!data || data["status"] !== "OK") {
    return {
      ok: false,
      items: [],
      summary: { average: 0, total: 0, stars: 0 },
      error: String(data?.["status"] ?? "respuesta_invalida"),
    };
  }

  const result = (data["result"] ?? {}) as Record<string, unknown>;
  const items: GoogleReviewItem[] = [];
  for (const rev of (result["reviews"] ?? []) as Record<string, unknown>[]) {
    items.push({
      author_name: String(rev["author_name"] ?? "Cliente"),
      rating: Math.round(Number(rev["rating"] ?? 5)),
      comment: String(rev["text"] ?? "").trim(),
      relative_time: String(rev["relative_time_description"] ?? ""),
      photo: String(rev["profile_photo_url"] ?? ""),
      profile_url: String(rev["author_url"] ?? ""),
      time: Number(rev["time"] ?? Math.floor(Date.now() / 1000)),
    });
  }

  const average = Math.round(Number(result["rating"] ?? 0) * 10) / 10;
  return {
    ok: true,
    items,
    summary: {
      average,
      total: Number(result["user_ratings_total"] ?? items.length),
      stars: Math.round(average),
    },
    error: null,
  };
}

/** Guarda (o actualiza) las resenas y la media. */
async function googleReviewsStore(items: GoogleReviewItem[], summary: { average: number; total: number; stars: number }) {
  const now = new Date();
  for (const it of items) {
    const key = md5(`${it.author_name}|${it.time}|${it.comment}`);
    await prisma.googleReview.upsert({
      where: { reviewKey: key },
      create: {
        reviewKey: key,
        author: it.author_name,
        rating: it.rating,
        body: it.comment,
        photo: it.photo,
        profileUrl: it.profile_url,
        relativeTime: it.relative_time,
        sortTs: it.time,
        fetchedAt: now,
      },
      update: {
        author: it.author_name,
        rating: it.rating,
        body: it.comment,
        photo: it.photo,
        profileUrl: it.profile_url,
        relativeTime: it.relative_time,
        sortTs: it.time,
        fetchedAt: now,
      },
    });
  }

  // Poda: solo las 20 mas recientes.
  const keep = await prisma.googleReview.findMany({
    orderBy: [{ sortTs: "desc" }, { id: "desc" }],
    take: 20,
    select: { id: true },
  });
  if (keep.length) {
    await prisma.googleReview.deleteMany({ where: { id: { notIn: keep.map((k) => k.id) } } });
  }

  await settingSet("google_reviews_summary", JSON.stringify(summary));
  await settingSet("google_reviews_fetched_at", now.toISOString().slice(0, 19).replace("T", " "));
}

/** Punto de entrada: resenas en vivo si se puede; si no, cache. */
export async function googleReviewsFetch(force = false) {
  const enabled = await googleReviewsEnabled();
  const cached = await googleReviewsCached(3);
  const updatedAt = await setting("google_reviews_fetched_at", "");

  const out: Record<string, unknown> = {
    ok: true,
    enabled,
    live: false,
    cached: cached.length > 0,
    stale: false,
    updated_at: updatedAt,
    summary: await googleReviewsSummaryCached(),
    items: cached,
  };

  if (!enabled) return out;

  const fresh =
    updatedAt !== "" &&
    (Date.now() - new Date(updatedAt.replace(" ", "T")).getTime()) / 1000 < (await googleReviewsTtl());
  if (!force && fresh) return out;

  const res = await googleReviewsRequest();
  if (!res.ok) {
    out["stale"] = cached.length > 0;
    out["error"] = res.error;
    return out;
  }

  await googleReviewsStore(res.items, res.summary);
  out["live"] = true;
  out["cached"] = true;
  out["stale"] = false;
  out["summary"] = res.summary;
  out["items"] = await googleReviewsCached(3);
  out["updated_at"] = await setting("google_reviews_fetched_at", "");
  return out;
}

/** Fuerza una actualizacion inmediata (boton del panel). */
export async function googleReviewsRefresh() {
  return googleReviewsFetch(true);
}

/** Enlace a la ficha del negocio en Google Maps. */
export async function googleReviewsPlaceUrl(): Promise<string> {
  const place = await googleReviewsPlaceId();
  if (place !== "") {
    return `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(place)}`;
  }
  return setting("google_maps_url", "");
}

/** MD5 (para la clave de deduplicacion de resenas). */
function md5(input: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("md5").update(input).digest("hex");
}
