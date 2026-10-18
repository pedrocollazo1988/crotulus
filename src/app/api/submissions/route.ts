import { NextRequest } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { jsonOk, jsonError, requestInput, input, clientIp, appLog } from "@/lib/http";
import { csrfRequire } from "@/lib/csrf";
import { captchaVerify } from "@/lib/captcha";
import { validateSubmission, e } from "@/lib/validator";
import { rateLimit, rateLimitGc } from "@/lib/rate-limit";
import { currentUser } from "@/lib/auth";
import {
  submissionsAutoApprove, submissionsEnabled, submissionTypeLabel,
} from "@/lib/submissions";
import { mailerTemplate, mailNotifyTo, sendMail } from "@/lib/mailer";
import { getConfig } from "@/lib/config";
import { prisma } from "@/lib/db";

/**
 * ============================================================================
 *  API DE APORTACIONES  ->  POST /api/submissions
 *  Puerto de api/submissions.php. Abierto a cualquier visitante (los
 *  testimonios no exigen cuenta); si hay sesion, se asocia al usuario. Los
 *  envios anonimos pasan por el captcha para frenar el spam.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await bootstrap();
  const data = await requestInput(req);
  const cfg = getConfig();

  if (!(await submissionsEnabled())) {
    return jsonError("Las aportaciones están desactivadas.", 503);
  }

  // Abierto a cualquier visitante; si hay sesion, se asocia a la cuenta.
  const user = await currentUser();

  const csrf = csrfRequire(req, data);
  if (csrf) return csrf;

  if (!(await rateLimit("submission", clientIp(req), cfg.security.submissionRateMax, cfg.security.submissionRateWindow))) {
    return jsonError("Has enviado demasiadas aportaciones. Inténtalo de nuevo más tarde.", 429);
  }
  await rateLimitGc();

  if (input(data, "_gotcha") !== "") {
    return jsonOk({ message: "¡Gracias por tu aportación!" });
  }

  // Captcha: obligatorio para visitantes anonimos; con sesion no hace falta.
  if (!user) {
    if (!captchaVerify(input(data, "captcha_token"), input(data, "captcha"))) {
      return jsonError("La verificacion de seguridad no es correcta. Intentalo de nuevo.", 422, {
        fields: { captcha: "Resuelve la operacion para demostrar que eres una persona." },
      });
    }
  }

  const result = validateSubmission(data);
  if (Object.keys(result.errors).length) {
    return jsonError("Revisa los campos marcados.", 422, { fields: result.errors });
  }
  const d = result.data;

  const status = (await submissionsAutoApprove()) ? "aprobada" : "pendiente";
  const now = new Date();
  const row = await prisma.userSubmission.create({
    data: {
      userId: user ? user.id : null,
      stype: d.stype,
      title: d.title,
      body: d.body,
      authorRole: d.authorRole,
      rating: d.rating,
      photoData: d.photo || null,
      status,
      ip: clientIp(req),
      createdAt: now,
      updatedAt: now,
    },
  });
  await appLog(`submission_created ${row.id} type=${d.stype} user=${user ? user.id : "anon"}`);

  const tipo = submissionTypeLabel(d.stype);
  const autor = d.title || (user ? user.name || user.email : "Visitante");
  const html = mailerTemplate(
    `Nueva aportación: ${tipo}`,
    `<p><strong>Tipo:</strong> ${e(tipo)}</p>
     <p><strong>Autor:</strong> ${e(autor)}${user ? "" : " <em>(visitante anónimo)</em>"}</p>
     <p><strong>Título:</strong> ${e(d.title)}</p>
     ${d.authorRole ? `<p><strong>Cargo / empresa:</strong> ${e(d.authorRole)}</p>` : ""}
     ${d.stype === "testimonio" ? `<p><strong>Valoración:</strong> ${d.rating}/5</p>` : ""}
     <p><strong>Detalle:</strong></p><p>${e(d.body).replace(/\n/g, "<br>")}</p>
     <p><em>Estado: ${status}.</em></p>`,
  );
  const notify = await mailNotifyTo();
  if (notify) await sendMail(notify, `Nueva aportación · ${getConfig().siteName}`, html);

  const message =
    status === "aprobada"
      ? "¡Gracias! Tu aportación ya está publicada."
      : "¡Gracias! Tu aportación se revisará antes de publicarse.";

  return jsonOk({ message, status });
}
