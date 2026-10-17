#!/usr/bin/env node
/**
 * ============================================================================
 *  ADMINISTRADOR DESIGNADO POR VARIABLE DE ENTORNO
 * ----------------------------------------------------------------------------
 *  En un despliegue serverless (Vercel + Neon) no hay acceso por shell a la
 *  base de datos. Para garantizar el acceso al panel sin depender de la carrera
 *  "el primer usuario registrado es admin", se designa el administrador con:
 *
 *      ADMIN_EMAIL          (opcional; si falta se usa el correo de avisos del
 *                            sitio —MAIL_TO o el ajuste "mail_to_email"—)
 *      ADMIN_PASSWORD       (opcional; se aplica al CREAR la cuenta o si aun no
 *                            tiene contrasena; si falta se genera una TEMPORAL
 *                            y se imprime una sola vez en el registro del build)
 *      ADMIN_RESET_PASSWORD (opcional; fuerza el cambio de contrasena en el
 *                            siguiente build, solo si difiere de la actual)
 *      ADMIN_DISABLE_2FA    (opcional; si es "1"/"true"/"yes"/"on", APAGA la
 *                            verificacion en dos pasos del administrador. Sirve
 *                            para recuperar el acceso cuando el envio de codigos
 *                            no funciona; a diferencia de TWO_FACTOR_MODE=disabled
 *                            (interruptor global) solo afecta al admin y no deja
 *                            ningun bypass activo en produccion)
 *      ADMIN_NAME           (opcional, por defecto "Administrador")
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
const { hash, compare } = require("bcryptjs");

if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
  console.log("[admin-bootstrap] Sin base de datos: se omite.");
  process.exit(0);
}

const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || "";
const name = process.env.ADMIN_NAME || "Administrador";
const disable2fa = /^(1|true|yes|on)$/i.test((process.env.ADMIN_DISABLE_2FA || "").trim());

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

    // Contrasena:
    //  - Al CREAR (o si la cuenta aun no tiene contrasena) se usa ADMIN_PASSWORD
    //    o, si falta, una temporal que se imprime una vez en el registro.
    //  - Si la cuenta ya tiene contrasena, NO se toca (asi un despliegue no pisa
    //    la que hayas cambiado en el panel). Para forzar un cambio puntual,
    //    define ADMIN_RESET_PASSWORD; se aplica solo si difiere de la actual.
    let plain = "";
    if (!existing || !existing.passwordHash) {
      plain = password || `Cr-${randomBytes(9).toString("base64url")}`;
    }

    const reset = process.env.ADMIN_RESET_PASSWORD || "";
    let newHash = plain ? await hash(plain, 10) : null;
    if (reset && existing?.passwordHash) {
      if (!(await compare(reset, existing.passwordHash))) {
        newHash = await hash(reset, 10);
        plain = reset;
        console.log("[admin-bootstrap] Contrasena restablecida por ADMIN_RESET_PASSWORD.");
      } else {
        newHash = null;
      }
    }

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: "admin",
          status: "active",
          emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          ...(newHash ? { passwordHash: newHash } : {}),
          ...(disable2fa
            ? { twoFactorEnabled: false, twoFactorRequired: false, twoFactorPending: false }
            : {}),
          updatedAt: new Date(),
        },
      });
      console.log(`[admin-bootstrap] Administrador actualizado: ${target}`);
      if (disable2fa) {
        console.log("[admin-bootstrap] 2FA del administrador DESACTIVADO (ADMIN_DISABLE_2FA).");
      }
    } else {
      await prisma.user.create({
        data: {
          email: target,
          name,
          passwordHash: newHash,
          role: "admin",
          status: "active",
          emailVerifiedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      console.log(`[admin-bootstrap] Administrador creado: ${target}`);
    }

    // Solo se imprime cuando la contrasena la genero el propio script (temporal).
    if (plain && !password && !reset) {
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
