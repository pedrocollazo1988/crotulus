#!/usr/bin/env node
/**
 * ============================================================================
 *  ADMINISTRADOR DESIGNADO POR VARIABLE DE ENTORNO
 * ----------------------------------------------------------------------------
 *  En un despliegue serverless (Vercel + Neon) no hay acceso por shell a la
 *  base de datos. Para garantizar el acceso al panel sin depender de la carrera
 *  "el primer usuario registrado es admin", se designa el administrador con:
 *
 *      ADMIN_EMAIL     (opcional; si falta se usa el correo de avisos del sitio
 *                       —MAIL_TO o el ajuste "mail_to_email"—)
 *      ADMIN_PASSWORD  (opcional; si falta se genera una TEMPORAL y se imprime
 *                       una sola vez en el registro del build)
 *      ADMIN_NAME      (opcional, por defecto "Administrador")
 *
 *  Se ejecuta en el build (via scripts/db-bootstrap.mjs). Es idempotente:
 *  crea el admin si no existe, o lo promueve/activa si ya existe.
 *
 *  Ademas degrada a "user" las cuentas con rol admin que nunca verificaron el
 *  correo: no pueden iniciar sesion y no deben ocupar el rol.
 * ============================================================================
 */
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const { hash } = require("bcryptjs");

if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
  console.log("[admin-bootstrap] Sin base de datos: se omite.");
  process.exit(0);
}

const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || "";
const name = process.env.ADMIN_NAME || "Administrador";

const prisma = new PrismaClient();

/**
 * Correo del administrador designado. Si no se define ADMIN_EMAIL, se usa el
 * correo que ya recibe los avisos del sitio (variable MAIL_TO o el ajuste
 * "mail_to_email"), que en este proyecto ya es el del propietario. Asi el
 * despliegue crea el admin sin configurar nada a mano.
 */
async function adminTargetEmail() {
  if (email) return email;
  const fromEnv = (process.env.MAIL_TO || "").trim().toLowerCase();
  if (fromEnv) return fromEnv;
  try {
    const row = await prisma.setting.findUnique({ where: { skey: "mail_to_email" } });
    return (row?.svalue || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

try {
  const target = await adminTargetEmail();
  if (target) {
    const existing = await prisma.user.findUnique({ where: { email: target } });

    // Sin ADMIN_PASSWORD: si la cuenta es nueva (o no tiene contrasena) se
    // genera una temporal y se imprime UNA vez en el registro del build. Asi el
    // administrador puede entrar sin depender del correo de recuperacion.
    let plain = password;
    if (!plain && (!existing || !existing.passwordHash)) {
      plain = `Cr-${randomBytes(9).toString("base64url")}`;
    }
    const passwordHash = plain ? await hash(plain, 10) : null;

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: "admin",
          status: "active",
          emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          ...(passwordHash ? { passwordHash } : {}),
          updatedAt: new Date(),
        },
      });
      console.log(`[admin-bootstrap] Administrador actualizado: ${target}`);
    } else {
      await prisma.user.create({
        data: {
          email: target,
          name,
          passwordHash,
          role: "admin",
          status: "active",
          emailVerifiedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      console.log(`[admin-bootstrap] Administrador creado: ${target}`);
    }

    if (plain && !password) {
      console.log(`[admin-bootstrap] CONTRASENA TEMPORAL (cambiala al entrar): ${plain}`);
    }
  } else {
    console.log("[admin-bootstrap] Sin correo de admin: el primer registrado sera admin.");
  }

  // Limpieza: un admin que nunca verifico el correo no puede iniciar sesion y
  // no deberia ocupar el rol. Se hace SOLO si ya existe algun admin verificado,
  // para no dejar nunca el sistema sin administrador (p. ej. el primer
  // registrado que todavia no ha abierto el enlace de verificacion).
  const verifiedAdmins = await prisma.user.count({
    where: { role: "admin", emailVerifiedAt: { not: null } },
  });
  if (verifiedAdmins > 0) {
    const strays = await prisma.user.updateMany({
      where: {
        role: "admin",
        emailVerifiedAt: null,
        ...(target ? { NOT: { email: target } } : {}),
      },
      data: { role: "user", updatedAt: new Date() },
    });
    if (strays.count) {
      console.log(`[admin-bootstrap] ${strays.count} admin(s) sin verificar degradados a usuario.`);
    }
  }
} catch (err) {
  console.warn(`[admin-bootstrap] Aviso: ${String(err).split("\n")[0]}`);
} finally {
  await prisma.$disconnect();
}
