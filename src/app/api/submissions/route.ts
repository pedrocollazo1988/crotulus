import { NextRequest } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { jsonOk, jsonError, requestInput, input, clientIp, appLog } from "@/lib/http";
import { csrfRequire } from "@/lib/csrf";
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
 *  Puerto de api/submissions.php (requiere sesion iniciada).
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

  const user = await currentUser();
  if (!user) return jsonError("Inicia sesión para continuar.", 401);

  const csrf = csrfRequire(req, data);
  if (csrf) return csrf;

  if (!(await rateLimit("submission", clientIp(req), cfg.security.submissionRateMax, cfg.security.submissionRateWindow))) {
    return jsonError("Has enviado demasiadas aportaciones. Inténtalo de nuevo más tarde.", 429);
  }
  await rateLimitGc();

  if (input(data, "_gotcha") !== "") {
    return jsonOk({ message: "¡Gracias por tu aportación!" });
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
      userId: user.id,
      stype: d.stype,
      title: d.title,
      body: d.body,
      status,
      ip: clientIp(req),
      createdAt: now,
      updatedAt: now,
    },
  });
  await appLog(`submission_created ${row.id} type=${d.stype} user=${user.id}`);

  const tipo = submissionTypeLabel(d.stype);
  const autor = user.name || user.email;
  const html = mailerTemplate(
    `Nueva aportación: ${tipo}`,
    `<p><strong>Tipo:</strong> ${e(tipo)}</p>
     <p><strong>Autor:</strong> ${e(autor)}</p>
     <p><strong>Título:</strong> ${e(d.title)}</p>
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
