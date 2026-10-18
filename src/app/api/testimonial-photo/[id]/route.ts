import { NextResponse, type NextRequest } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Sirve la foto de un testimonio. La imagen viaja como data URL en
 * `user_submissions.photo_data` (recortada y comprimida en el navegador a
 * ~256px JPEG), de modo que no hace falta almacenamiento externo.
 * Solo es publica si la aportacion esta aprobada; el administrador puede verla
 * en cualquier estado para moderarla.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await bootstrap();
  const { id } = await ctx.params;
  const numId = Number.parseInt(id, 10);
  if (!Number.isFinite(numId) || numId <= 0) return new NextResponse(null, { status: 404 });

  const row = await prisma.userSubmission.findUnique({
    where: { id: numId },
    select: { status: true, photoData: true },
  });
  const visible = row && (row.status === "aprobada" || (await isAdmin()));
  const match = visible ? /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(row?.photoData ?? "") : null;
  if (!match) return new NextResponse(null, { status: 404 });

  const body = Buffer.from(match[2], "base64");
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": `image/${match[1]}`,
      "Content-Length": String(body.length),
      // Solo las aprobadas son publicas e inmutables; las pendientes que ve el
      // administrador no deben quedar cacheadas.
      "Cache-Control": row?.status === "aprobada" ? "public, max-age=86400, immutable" : "no-store",
    },
  });
}
