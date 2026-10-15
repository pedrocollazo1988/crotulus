import { NextRequest, NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { csrfVerify } from "@/lib/csrf";
import { authLogout } from "@/lib/auth";
import { requestInput, requestOrigin } from "@/lib/http";

/**
 * ============================================================================
 *  CERRAR SESION  ->  /api/logout
 *  Puerto de admin/logout.php. Acepta POST (con CSRF) o GET.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

async function doLogout(req: NextRequest): Promise<NextResponse> {
  await bootstrap();
  if (req.method === "POST") {
    const data = await requestInput(req);
    if (csrfVerify(data["_csrf"] as string | undefined)) {
      await authLogout();
    }
  } else {
    await authLogout();
  }
  // El redirect debe apuntar al host PUBLICO: tras un proxy, `req.url` lleva el
  // host interno (http://localhost:12000) y el navegador no lo alcanzaria.
  // NextResponse.redirect exige una URL absoluta, asi que si no hay cabeceras
  // reenviadas caemos a `req.url` (correcto cuando no hay proxy delante).
  const origin = requestOrigin(req) || new URL(req.url).origin;
  return NextResponse.redirect(`${origin}/admin/login`);
}

export async function POST(req: NextRequest) {
  return doLogout(req);
}

export async function GET(req: NextRequest) {
  return doLogout(req);
}
