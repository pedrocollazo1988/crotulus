import { NextRequest, NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { url } from "@/lib/http";
import { authConsumeToken, authLogin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { e } from "@/lib/validator";
import { clientIp, userAgent } from "@/lib/http";

/**
 * ============================================================================
 *  VERIFICACION DE CORREO  ->  GET /api/verify?token=...
 *  Puerto de api/verify.php. Marca la cuenta como activa y muestra el resultado.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await bootstrap();
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const user = token !== "" ? await authConsumeToken("email_verify", token) : null;

  let title: string;
  let message: string;
  let ok: boolean;

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        status: "active",
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        updatedAt: new Date(),
      },
    });
    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    if (fresh) {
      await authLogin(fresh, clientIp(req), userAgent(req));
    }
    title = "Correo verificado";
    message = "Tu cuenta ya está activa. Te hemos iniciado la sesión.";
    ok = true;
  } else {
    title = "Enlace no válido";
    message = "El enlace de verificación ha caducado o ya se ha usado. Vuelve a registrarte o pide un enlace nuevo.";
    ok = false;
  }

  return new NextResponse(renderResult(title, message, ok), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function renderResult(title: string, message: string, ok: boolean): string {
  const base = e(url(""));
  const color = ok ? "#0B5A93" : "#B42318";
  const site = e(getConfig().siteName);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(title)} · ${site}</title>
<style>body{font-family:Arial,Helvetica,sans-serif;background:#F6F8FA;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.box{background:#fff;border-radius:16px;padding:40px;max-width:440px;text-align:center;box-shadow:0 10px 40px rgba(11,46,69,.10)}
h1{color:${color};font-size:22px;margin:0 0 12px}p{color:#1F2937;line-height:1.6}
a.btn{display:inline-block;margin-top:18px;background:#0B5A93;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600}</style></head><body>
<div class="box"><h1>${e(title)}</h1><p>${e(message)}</p><a class="btn" href="${base}/admin/">Ir al panel</a></div></body></html>`;
}
