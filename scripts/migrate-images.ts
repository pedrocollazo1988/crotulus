import { PrismaClient } from "@prisma/client";

/**
 * Migracion de datos: sustituye las ilustraciones SVG de la portada por las
 * fotos reales (mismo nombre base, extension .jpg). Idempotente: al volver a
 * ejecutarse no encuentra rutas .svg y no hace nada. No pisa imagenes que el
 * administrador haya cambiado a otra ruta distinta de las conocidas.
 */
const prisma = new PrismaClient();

// Rutas antiguas (svg) -> nuevas (jpg). El hero y "sobre nosotros" comparten
// la foto de equipo, asi que las dos apuntan a hero-tech.jpg.
const MAP: Record<string, string> = {
  "assets/img/hero-tech.svg": "assets/img/hero-tech.jpg",
  "assets/img/equipo.svg": "assets/img/hero-tech.jpg",
  "assets/img/proyecto-web.svg": "assets/img/proyecto-web.jpg",
  "assets/img/proyecto-ia.svg": "assets/img/proyecto-ia.jpg",
  "assets/img/proyecto-redes.svg": "assets/img/proyecto-redes.jpg",
  "assets/img/blog/automatizacion-ia-pymes.svg": "assets/img/blog/automatizacion-ia-pymes.jpg",
  "assets/img/blog/seguridad-red-pyme.svg": "assets/img/blog/seguridad-red-pyme.jpg",
  "assets/img/blog/web-que-convierte.svg": "assets/img/blog/web-que-convierte.jpg",
};

async function main() {
  let changed = 0;

  // 1) Ajustes (hero_image, about_image)
  const settings = await prisma.setting.findMany();
  for (const s of settings) {
    const next = s.svalue ? MAP[s.svalue] : undefined;
    if (next) {
      await prisma.setting.update({ where: { skey: s.skey }, data: { svalue: next, updatedAt: new Date() } });
      changed++;
      console.log(`setting ${s.skey}: ${s.svalue} -> ${next}`);
    }
  }

  // 2) Proyectos (meta.image dentro de content_items)
  const items = await prisma.contentItem.findMany({ where: { ctype: "proyecto" } });
  for (const it of items) {
    const meta = (it.meta as Record<string, unknown> | null) ?? {};
    const img = typeof meta.image === "string" ? meta.image : undefined;
    if (img && MAP[img]) {
      await prisma.contentItem.update({ where: { id: it.id }, data: { meta: { ...meta, image: MAP[img] } } });
      changed++;
      console.log(`proyecto #${it.id}: ${img} -> ${MAP[img]}`);
    }
  }

  // 3) Blog
  const posts = await prisma.blogPost.findMany();
  for (const b of posts) {
    if (b.image && MAP[b.image]) {
      await prisma.blogPost.update({ where: { id: b.id }, data: { image: MAP[b.image] } });
      changed++;
      console.log(`blog #${b.id}: ${b.image} -> ${MAP[b.image]}`);
    }
  }

  console.log(changed ? `[migrate-images] ${changed} rutas actualizadas` : "[migrate-images] sin cambios");
}

main()
  .catch((e) => {
    console.warn(`[migrate-images] ${e instanceof Error ? e.message : e}`);
    process.exitCode = 0;
  })
  .finally(() => prisma.$disconnect());
