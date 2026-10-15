import { NextRequest } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { jsonOk, jsonError, requestInput, input, clientIp, userAgent, appLog } from "@/lib/http";
import { csrfRequire } from "@/lib/csrf";
import { validateReview, e } from "@/lib/validator";
import { rateLimit, rateLimitGc } from "@/lib/rate-limit";
import { currentUser } from "@/lib/auth";
import { reviewsAutoApprove, reviewsEnabled } from "@/lib/reviews";
import { mailerTemplate, mailNotifyTo, sendMail } from "@/lib/mailer";
import { getConfig } from "@/lib/config";
import { prisma } from "@/lib/db";

/**
 * ============================================================================
 *  API DE VALORACIONES  ->  POST /api/reviews
 *  Puerto de api/reviews.php (abierto a cualquier visitante).
 * ============================================================================
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await bootstrap();
  const data = await requestInput(req);
  const cfg = getConfig();

  if (!(await reviewsEnabled())) {
    return jsonError("Las valoraciones están desactivadas.", 503);
  }

  const user = await currentUser();
  const userId = user ? user.id : 0;

  const csrf = csrfRequire(req, data);
  if (csrf) return csrf;

  if (!(await rateLimit("review", clientIp(req), cfg.security.reviewRateMax, cfg.security.reviewRateWindow))) {
    return jsonError("Has enviado demasiadas valoraciones. Inténtalo de nuevo más tarde.", 429);
  }
  await rateLimitGc();

  if (input(data, "_gotcha") !== "") {
    return jsonOk({ message: "¡Gracias por tu valoración!" });
  }

  const result = validateReview(data);
  if (Object.keys(result.errors).length) {
    return jsonError("Revisa los campos marcados.", 422, { fields: result.errors });
  }
  const d = result.data;

  const status = (await reviewsAutoApprove()) ? "aprobada" : "pendiente";
  const row = await prisma.review.create({
    data: {
      targetType: d.targetType,
      targetId: d.targetId,
      targetLabel: d.targetLabel,
      rating: d.rating,
      authorName: d.authorName,
      authorEmail: d.authorEmail,
      comment: d.comment,
      userId,
      status,
      ip: clientIp(req),
      userAgent: userAgent(req),
      createdAt: new Date(),
    },
  });
  await appLog(`review_created ${row.id} rating=${d.rating} type=${d.targetType}`);

  const html = mailerTemplate(
    "Nueva valoración recibida",
    `<p><strong>Puntuación:</strong> ${d.rating} / 5</p>
     <p><strong>Tipo:</strong> ${e(d.targetType)}</p>
     <p><strong>Elemento:</strong> ${e(d.targetLabel)}</p>
     <p><strong>Autor:</strong> ${e(d.authorName)} (${e(d.authorEmail)})</p>
     <p><strong>Comentario:</strong></p><p>${e(d.comment).replace(/\n/g, "<br>")}</p>
     <p><em>Estado: ${status}.</em></p>`,
  );
  const notify = await mailNotifyTo();
  if (notify) await sendMail(notify, `Nueva valoración · ${getConfig().siteName}`, html);

  const message =
    status === "aprobada"
      ? "¡Gracias por tu valoración! Ya está publicada."
      : "¡Gracias por tu valoración! Se publicará tras una breve revisión.";

  return jsonOk({ message, status });
}
