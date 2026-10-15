import { NextRequest } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { jsonOk, jsonError, requestInput, input, clientIp, userAgent, appLog } from "@/lib/http";
import { csrfRequire } from "@/lib/csrf";
import { captchaVerify } from "@/lib/captcha";
import { validateContact } from "@/lib/validator";
import { rateLimit, rateLimitGc } from "@/lib/rate-limit";
import { currentUser } from "@/lib/auth";
import { mailerTemplate, mailNotifyTo, sendMail } from "@/lib/mailer";
import { getConfig } from "@/lib/config";
import { prisma } from "@/lib/db";
import { e } from "@/lib/validator";

/**
 * ============================================================================
 *  API DE CONTACTO  ->  POST /api/contact
 *  Puerto de api/contact.php (abierto a cualquier visitante).
 * ============================================================================
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await bootstrap();
  const data = await requestInput(req);

  // 0. Abierto a cualquier visitante; si hay sesion, se asocia.
  const user = await currentUser();
  const userId = user ? user.id : 0;

  // 1. Anti-CSRF
  const csrf = csrfRequire(req, data);
  if (csrf) return csrf;

  // 2. Limite por IP
  const cfg = getConfig();
  if (!(await rateLimit("contact", clientIp(req), cfg.security.contactRateMax, cfg.security.contactRateWindow))) {
    return jsonError("Has enviado demasiados mensajes. Inténtalo de nuevo más tarde.", 429);
  }
  await rateLimitGc();

  // 3. Campo trampa
  if (input(data, "_gotcha") !== "") {
    return jsonOk({ message: "Gracias, hemos recibido tu mensaje." });
  }

  // 3b. Captcha
  if (!captchaVerify(input(data, "captcha_token"), input(data, "captcha"))) {
    return jsonError("La verificacion de seguridad no es correcta. Intentalo de nuevo.", 422, {
      fields: { captcha: "Resuelve la operacion para demostrar que eres una persona." },
    });
  }

  // 4. Validacion
  const result = validateContact(data);
  if (Object.keys(result.errors).length) {
    return jsonError("Revisa los campos marcados.", 422, { fields: result.errors });
  }
  const d = result.data;

  // 5. Guardado
  const row = await prisma.contactMessage.create({
    data: {
      userId,
      name: d.name,
      email: d.email,
      phone: d.phone,
      service: d.service,
      message: d.message,
      status: "nuevo",
      ip: clientIp(req),
      userAgent: userAgent(req),
      createdAt: new Date(),
    },
  });
  await appLog(`contact_message ${row.id} ${d.email}`);

  // 6. Aviso por correo (no bloquea)
  const html = mailerTemplate(
    "Nuevo mensaje de contacto",
    `<p><strong>Nombre:</strong> ${e(d.name)}</p>
     <p><strong>Correo:</strong> ${e(d.email)}</p>
     <p><strong>Teléfono:</strong> ${e(d.phone)}</p>
     <p><strong>Servicio:</strong> ${e(d.service)}</p>
     <p><strong>Mensaje:</strong></p><p>${e(d.message).replace(/\n/g, "<br>")}</p>`,
  );
  const notify = await mailNotifyTo();
  if (notify !== "") {
    await sendMail(notify, `Nuevo mensaje de contacto · ${getConfig().siteName}`, html, "", d.email);
  }

  return jsonOk({ message: "Gracias, hemos recibido tu mensaje. Te responderemos en breve." });
}
