import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

/**
 * ============================================================================
 *  FIJAR LA CONTRASENA DE UN USUARIO  (utilidad de administracion)
 *  Uso: npm run user:password -- correo@dominio.com "NuevaContrasena123"
 *  Tambien acepta la contrasena por la variable de entorno NEW_PASSWORD para
 *  no dejarla en el historial de la shell.
 *  Nota: hashea con bcrypt coste 10 igual que src/lib/password.ts (que no se
 *  importa aqui porque lleva "server-only", no disponible fuera de Next).
 * ============================================================================
 */
const prisma = new PrismaClient();
const ROUNDS = 10;

async function main() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  const password = process.env.NEW_PASSWORD || process.argv[3] || "";

  if (!email || !password) {
    console.error('Uso: npm run user:password -- correo@dominio.com "NuevaContrasena123"');
    console.error("     NEW_PASSWORD=... npm run user:password -- correo@dominio.com");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("La contrasena debe tener al menos 8 caracteres.");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No existe ningun usuario con el correo ${email}.`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hash(password, ROUNDS),
      status: "active",
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    },
  });

  // Un cambio de contrasena invalida los intentos fallidos acumulados.
  await prisma.rateLimit.deleteMany({ where: { bucket: "login" } });

  console.log(`Contrasena actualizada para ${email} (rol: ${user.role}).`);
  console.log("Se limpiaron los limites de intentos de acceso.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
