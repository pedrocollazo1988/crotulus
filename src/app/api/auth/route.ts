import { NextRequest, NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { jsonOk, jsonError, requestInput, input, clientIp, userAgent, appLog, url } from "@/lib/http";
import { csrfRequire, csrfVerify } from "@/lib/csrf";
import { normalizeEmail, validateName, validatePassword } from "@/lib/validator";
import { rateLimit } from "@/lib/rate-limit";
import {
  authCheckCredentials, authCreateUser, authFindByEmail, authIsFirstUser, authLogin,
  authLogout, currentUser, googleAuthUrl, googleEnabled, googleExchangeCode,
  googleFindOrCreate, googleUserinfo, publicUser, authCreateToken,
} from "@/lib/auth";
import {
  startTwoFactorChallenge, verifyTwoFactorChallenge, twoFactorRequiredFor,
  isTrustedDevice, trustDevice, toTwoFactorUser, challengeUser,
  CHALLENGE_COOKIE, DEVICE_COOKIE,
} from "@/lib/twofactor";
import { generateToken, setScopedCookie, readScopedCookie, clearScopedCookie } from "@/lib/session";
import { getConfig } from "@/lib/config";
import { prisma } from "@/lib/db";
import { mailerTemplate, sendMail } from "@/lib/mailer";
import { e } from "@/lib/validator";
import { cookies } from "next/headers";

/**
 * ============================================================================
 *  API DE AUTENTICACION  ->  /api/auth?action=...
 *  Puerto de api/auth.php (register, login, logout, forgot, me,
 *  google_start, google_callback).
 * ============================================================================
 */
export const dynamic = "force-dynamic";

const GOOGLE_STATE_COOKIE = "crotulus_gstate";

export async function GET(req: NextRequest) {
  await bootstrap();
  const action = req.nextUrl.searchParams.get("action") ?? "";
  switch (action) {
    case "me": {
      const user = await currentUser();
      if (!user) return jsonError("No hay sesión iniciada.", 401);
      return jsonOk({ user: publicUser(user) });
    }
    case "google_start": {
      if (!(await googleEnabled())) {
        return NextResponse.redirect(url("admin/login?status=google_off"));
      }
      const state = generateToken(16);
      const store = await cookies();
      store.set(GOOGLE_STATE_COOKIE, state, {
        httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
        path: "/", maxAge: 600,
      });
      return NextResponse.redirect(await googleAuthUrl(state));
    }
    case "google_callback": {
      if (!(await googleEnabled())) return jsonError("El acceso con Google no está configurado.", 503);
      const state = req.nextUrl.searchParams.get("state") ?? "";
      const code = req.nextUrl.searchParams.get("code") ?? "";
      const store = await cookies();
      const expected = store.get(GOOGLE_STATE_COOKIE)?.value ?? "";
      store.delete(GOOGLE_STATE_COOKIE);
      if (!expected || expected !== state) return jsonError("Solicitud de Google no válida (state).", 400);
      if (code === "") return jsonError("Google no devolvió el código de autorización.", 400);

      const accessToken = await googleExchangeCode(code);
      if (!accessToken) return jsonError("No se pudo validar la sesión con Google.", 502);
      const info = await googleUserinfo(accessToken);
      if (!info) return jsonError("No se pudieron obtener tus datos de Google.", 502);

      const userId = await googleFindOrCreate(info);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const tfUser = toTwoFactorUser(user);
        // Google ya verifica la identidad, pero si la cuenta exige 2FA propia
        // (p. ej. un administrador), pedimos tambien el codigo.
        if (twoFactorRequiredFor(tfUser) && !(await isTrustedDevice(user.id, await readScopedCookie(DEVICE_COOKIE)))) {
          const started = await startTwoFactorChallenge(tfUser, clientIp(req), "login");
          if (started.ok && started.challenge) {
            await setScopedCookie(CHALLENGE_COOKIE, started.challenge, getConfig().security.twoFactorCodeTtl);
            return NextResponse.redirect(url("admin/verify-2fa"));
          }
          // Si no se puede enviar el codigo, no bloqueamos un login de Google valido.
          await appLog(`google_2fa_envio_fallido user=${user.id}`);
        }
        await authLogin(user, clientIp(req), userAgent(req));
      }
      return NextResponse.redirect(url("admin/"));
    }
    default:
      return jsonError("Acción no reconocida.", 404);
  }
}

export async function POST(req: NextRequest) {
  await bootstrap();
  const action = req.nextUrl.searchParams.get("action") ?? "";
  const data = await requestInput(req);
  const cfg = getConfig();

  switch (action) {
    case "register": {
      const csrf = csrfRequire(req, data);
      if (csrf) return csrf;
      if (!(await rateLimit("register", clientIp(req), 10, 3600))) {
        return jsonError("Demasiados intentos. Prueba más tarde.", 429);
      }
      const email = normalizeEmail(input(data, "email"));
      const name = input(data, "name");
      const pass = input(data, "password");

      const errors: Record<string, string> = {};
      if (email === null) errors["email"] = "Escribe un correo válido.";
      const nameErrors = validateName(name);
      if (nameErrors.length) errors["name"] = nameErrors.join(" ");
      const passErrors = validatePassword(pass, cfg.security.passwordMin, cfg.security.passwordMax);
      if (passErrors.length) errors["password"] = passErrors.join(" ");
      if (Object.keys(errors).length || email === null) {
        return jsonError("Revisa los datos.", 422, { fields: errors });
      }

      if (await authFindByEmail(email)) {
        return jsonError("Ya existe una cuenta con este correo.", 409);
      }

      const userId = await authCreateUser(email, name, pass, "pending");
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) await sendVerificationEmail(user.id, user.email, user.name);
      await appLog(`user_registered ${userId} ${email}`);
      return jsonOk({ message: "Cuenta creada. Revisa tu correo para verificarla." });
    }

    case "login": {
      const csrf = csrfRequire(req, data);
      if (csrf) return csrf;
      if (!(await rateLimit("login", clientIp(req), cfg.security.loginRateMax, cfg.security.loginRateWindow))) {
        return jsonError("Demasiados intentos. Espera unos minutos.", 429);
      }
      const email = normalizeEmail(input(data, "email"));
      const pass = input(data, "password");

      const errors: Record<string, string> = {};
      if (email === null) errors["email"] = "Escribe un correo válido.";
      if (pass === "") errors["password"] = "Escribe tu contraseña.";
      if (Object.keys(errors).length || email === null) {
        return jsonError("Revisa los datos.", 422, { fields: errors });
      }

      const user = await authCheckCredentials(email, pass);
      if (!user) {
        await appLog(`login_failed ${email} ${clientIp(req)}`);
        return jsonError("Correo o contraseña incorrectos.", 401);
      }
      if (user.status === "pending" && user.emailVerifiedAt === null) {
        return jsonError("Tu cuenta aún no está verificada. Revisa tu correo.", 403);
      }
      if (user.status === "banned") {
        return jsonError("Esta cuenta está deshabilitada.", 403);
      }

      // Verificacion en dos pasos: no abrir sesion hasta validar el codigo.
      if (twoFactorRequiredFor(user) && !(await isTrustedDevice(user.id, await readScopedCookie(DEVICE_COOKIE)))) {
        const started = await startTwoFactorChallenge(toTwoFactorUser(user), clientIp(req), "login");
        if (!started.ok || !started.challenge) {
          return jsonError(started.error ?? "No se pudo iniciar la verificación en dos pasos.", 502);
        }
        await setScopedCookie(CHALLENGE_COOKIE, started.challenge, getConfig().security.twoFactorCodeTtl);
        await appLog(`login_2fa_challenge ${user.id} channel=${started.channel}`);
        return jsonOk({
          two_factor: true,
          channel: started.channel,
          masked: started.masked,
          next: "/admin/verify-2fa",
        });
      }

      await authLogin(user, clientIp(req), userAgent(req));
      await appLog(`login_ok ${user.id}`);
      return jsonOk({ user: publicUser(user) });
    }

    case "verify_2fa": {
      const csrf = csrfRequire(req, data);
      if (csrf) return csrf;
      if (!(await rateLimit("verify_2fa", clientIp(req), 20, 900))) {
        return jsonError("Demasiados intentos. Espera unos minutos.", 429);
      }
      const challenge = await readScopedCookie(CHALLENGE_COOKIE);
      const result = await verifyTwoFactorChallenge(challenge, input(data, "code"), "login");
      if (!result.ok || !result.user) {
        if (result.lockedOut) await clearScopedCookie(CHALLENGE_COOKIE);
        await appLog(`two_factor_failed ip=${clientIp(req)}`);
        return jsonError(result.error ?? "Código incorrecto.", 401);
      }
      await clearScopedCookie(CHALLENGE_COOKIE);
      await authLogin(result.user, clientIp(req), userAgent(req));
      // "Recordar este dispositivo": token de confianza con caducidad.
      if (getConfig().security.twoFactorRememberDevice && input(data, "remember") === "1") {
        const deviceToken = await trustDevice(result.user.id, clientIp(req), userAgent(req));
        await setScopedCookie(DEVICE_COOKIE, deviceToken, getConfig().security.twoFactorTrustDeviceDays * 86400);
      }
      await appLog(`login_2fa_ok ${result.user.id}`);
      return jsonOk({ user: publicUser(result.user), next: result.user.role === "admin" ? "/admin/" : "/admin/account" });
    }

    case "resend_2fa": {
      const csrf = csrfRequire(req, data);
      if (csrf) return csrf;
      if (!(await rateLimit("resend_2fa", clientIp(req), 5, 900))) {
        return jsonError("Demasiados reenvíos. Espera unos minutos.", 429);
      }
      const challenge = await readScopedCookie(CHALLENGE_COOKIE);
      if (!challenge) return jsonError("La sesión de verificación ha caducado. Vuelve a iniciar sesión.", 401);
      const challengeUserRow = await challengeUser(challenge, "login");
      if (!challengeUserRow) {
        return jsonError("La verificación ha caducado. Vuelve a iniciar sesión.", 401);
      }
      const started = await startTwoFactorChallenge(challengeUserRow, clientIp(req), "login");
      if (!started.ok || !started.challenge) {
        return jsonError(started.error ?? "No se pudo reenviar el código.", 502);
      }
      await setScopedCookie(CHALLENGE_COOKIE, started.challenge, getConfig().security.twoFactorCodeTtl);
      return jsonOk({ two_factor: true, channel: started.channel, masked: started.masked });
    }

    case "logout": {
      const csrf = csrfRequire(req, data);
      if (csrf) return csrf;
      await authLogout();
      return jsonOk({ message: "Sesión cerrada." });
    }

    case "forgot": {
      const csrf = csrfRequire(req, data);
      if (csrf) return csrf;
      if (!(await rateLimit("forgot", clientIp(req), 5, 3600))) {
        return jsonError("Demasiadas solicitudes. Prueba más tarde.", 429);
      }
      const email = normalizeEmail(input(data, "email"));
      if (email === null) {
        return jsonError("Escribe un correo válido.", 422, { fields: { email: "Escribe un correo válido." } });
      }
      const user = await authFindByEmail(email);
      if (user) await sendPasswordResetEmail(user.id, user.email, user.name);
      return jsonOk({ message: "Si el correo existe, recibirás un enlace para restablecerla." });
    }

    default:
      return jsonError("Acción no reconocida.", 404);
  }
}

/** Envia el correo de verificacion de cuenta. */
async function sendVerificationEmail(userId: number, email: string, name: string): Promise<void> {
  const token = await authCreateToken(userId, "email_verify", 86400 * 2);
  const link = url(`api/verify?token=${encodeURIComponent(token)}`);
  const html = mailerTemplate(
    "Verifica tu correo",
    `<p>Hola ${e(name || email)},</p>
     <p>Gracias por crear tu cuenta en <strong>${e(getConfig().siteName)}</strong>. Confirma tu correo pulsando el botón:</p>
     <p><a class="btn" href="${link}">Verificar mi correo</a></p>
     <p>El enlace caduca en 48 horas. Si no has sido tú, ignora este mensaje.</p>`,
  );
  await sendMail(email, `Verifica tu correo · ${getConfig().siteName}`, html);
}

/** Envia el correo para restablecer la contrasena. */
async function sendPasswordResetEmail(userId: number, email: string, name: string): Promise<void> {
  const token = await authCreateToken(userId, "password_reset", 3600);
  const link = url(`admin/reset?token=${encodeURIComponent(token)}`);
  const html = mailerTemplate(
    "Restablece tu contraseña",
    `<p>Hola ${e(name || email)},</p>
     <p>Has pedido cambiar tu contraseña. Pulsa el botón para elegir una nueva:</p>
     <p><a class="btn" href="${link}">Cambiar mi contraseña</a></p>
     <p>El enlace caduca en 1 hora. Si no lo has pedido, ignora este mensaje.</p>`,
  );
  await sendMail(email, `Restablece tu contraseña · ${getConfig().siteName}`, html);
}

