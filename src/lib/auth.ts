import "server-only";
import { prisma } from "./db";
import { getConfig } from "./config";
import { hashPassword, verifyPassword } from "./password";
import { createSession, generateToken, readSession, revokeCurrentSession, setSessionCookie, tokenHash } from "./session";

/**
 * ============================================================================
 *  AUTENTICACION (puerto de app/lib/auth.php)
 *  Registro, login, verificacion, recuperacion y Google OAuth.
 * ============================================================================
 */

export interface User {
  id: number;
  email: string;
  name: string;
  passwordHash: string | null;
  role: string;
  status: string;
  emailVerifiedAt: Date | null;
  googleId: string | null;
  avatarUrl: string | null;
}

const USER_SELECT = {
  id: true, email: true, name: true, passwordHash: true, role: true,
  status: true, emailVerifiedAt: true, googleId: true, avatarUrl: true,
} as const;

/** Usuario autenticado actual (o null). */
export async function currentUser(): Promise<User | null> {
  const session = await readSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({ where: { id: session.uid }, select: USER_SELECT });
  if (!user || user.status === "banned") {
    await revokeCurrentSession();
    return null;
  }
  return user;
}

/** true si hay sesion iniciada. */
export async function isLoggedIn(): Promise<boolean> {
  return (await currentUser()) !== null;
}

/** true si el usuario es administrador. */
export async function isAdmin(): Promise<boolean> {
  const user = await currentUser();
  return user !== null && user.role === "admin";
}

/**
 * true si todavia no existe ningun administrador en el sistema. Se usa para
 * elegir el rol al crear una cuenta: el primero en llegar es admin. Se cuenta
 * por rol (no el total de usuarios) para que una cuenta sin verificar, o el
 * administrador designado por ADMIN_EMAIL, no consuman la promocion por error.
 */
export async function authIsFirstUser(): Promise<boolean> {
  return (await prisma.user.count({ where: { role: "admin" } })) === 0;
}

/** Crea la sesion del usuario y guarda la cookie. */
export async function authLogin(user: User, ip: string, ua: string): Promise<void> {
  const { token } = await createSession(user.id, ip, ua);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await setSessionCookie(token);
}

/** Cierra la sesion actual. */
export async function authLogout(): Promise<void> {
  await revokeCurrentSession();
}

/** Busca un usuario por correo. */
export async function authFindByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: USER_SELECT });
}

/** Crea un usuario y devuelve su id. */
export async function authCreateUser(
  email: string,
  name: string,
  password: string | null,
  status = "pending",
  role: string | null = null,
): Promise<number> {
  const finalRole = role ?? ((await authIsFirstUser()) ? "admin" : "user");
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      name,
      passwordHash: password !== null ? await hashPassword(password) : null,
      role: finalRole,
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  return user.id;
}

/** Comprueba credenciales. Devuelve el usuario o null. */
export async function authCheckCredentials(email: string, password: string): Promise<User | null> {
  const user = await authFindByEmail(email);
  if (!user) {
    await verifyPassword(password, "$2y$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV");
    return null;
  }
  if (!(await verifyPassword(password, user.passwordHash))) return null;
  return user;
}

/* ---------------------------------------------------------------------------
 *  TOKENS DE UN SOLO USO
 * ------------------------------------------------------------------------- */

/** Crea un token y devuelve su valor en claro. */
export async function authCreateToken(userId: number, type: string, ttlSeconds = 86400): Promise<string> {
  await prisma.token.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  const token = generateToken(32);
  await prisma.token.create({
    data: {
      userId,
      type,
      tokenHash: tokenHash(token),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      createdAt: new Date(),
    },
  });
  return token;
}

/** Consume un token valido y devuelve el usuario, o null. */
export async function authConsumeToken(type: string, token: string): Promise<User | null> {
  if (!token) return null;
  const row = await prisma.token.findFirst({
    where: { type, tokenHash: tokenHash(token), usedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!row) return null;
  await prisma.token.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return prisma.user.findUnique({ where: { id: row.userId }, select: USER_SELECT });
}

/** Datos publicos del usuario (nunca el hash). */
export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    avatar: user.avatarUrl,
  };
}

/* -------------------------------------------------------------------------
   GOOGLE OAUTH 2.0
   ------------------------------------------------------------------------- */

/** Client ID de Google (primero Ajustes, luego config). */
export async function googleClientId(): Promise<string> {
  const { setting } = await import("./settings");
  const fromSettings = await setting("google_client_id", "");
  return fromSettings !== "" ? fromSettings : getConfig().google.clientId;
}

/** Client secret de Google. */
export async function googleClientSecret(): Promise<string> {
  const { setting } = await import("./settings");
  const fromSettings = await setting("google_client_secret", "");
  return fromSettings !== "" ? fromSettings : getConfig().google.clientSecret;
}

/** true si Google esta configurado. */
export async function googleEnabled(): Promise<boolean> {
  return (await googleClientId()) !== "";
}

/**
 * Diagnostico de la configuracion de Google. Detecta los errores tipicos que
 * Google rechaza con "invalid_client": un Client ID que en realidad es un
 * secreto (`GOCSPX-...`) o que no tiene el formato `.apps.googleusercontent.com`,
 * y una URI de redireccion que no apunta a este sitio. Devuelve la lista de
 * problemas (vacia = configuracion correcta).
 */
export async function googleConfigIssues(): Promise<string[]> {
  const issues: string[] = [];
  const clientId = await googleClientId();
  const secret = await googleClientSecret();
  if (clientId === "") return issues;

  if (clientId.startsWith("GOCSPX-")) {
    issues.push(
      "En «Client ID» hay un Client SECRET (empieza por GOCSPX-). Los dos campos están cambiados: el Client ID es el que termina en .apps.googleusercontent.com.",
    );
  } else if (!clientId.endsWith(".apps.googleusercontent.com")) {
    issues.push(
      "El Client ID no tiene el formato esperado (debe terminar en .apps.googleusercontent.com).",
    );
  }
  if (secret.startsWith("GOCSPX-") && clientId.endsWith(".apps.googleusercontent.com")) {
    // Correcto: el secreto empieza por GOCSPX-.
  } else if (secret !== "" && secret.includes(".apps.googleusercontent.com")) {
    issues.push(
      "En «Client secret» parece haber un Client ID (contiene .apps.googleusercontent.com). Revisa que no estén cambiados.",
    );
  }

  const redirect = await googleRedirectUri();
  const redirectHost = hostOf(redirect);
  const siteHost = await requestHost();
  if (redirectHost && siteHost && redirectHost !== siteHost && !isLocalHost(siteHost) && !isLocalHost(redirectHost)) {
    issues.push(
      `La URI de redirección (${redirect}) apunta a «${redirectHost}», pero el sitio se está sirviendo en «${siteHost}». Google devolverá «redirect_uri_mismatch».`,
    );
  }
  return issues;
}

/** Host de una URL, o "" si no es válida. */
function hostOf(value: string): string {
  try {
    return new URL(value).host.replace(/:443$/, "");
  } catch {
    return "";
  }
}

/** Host desde el que se está sirviendo la página (cabeceras reenviadas). */
async function requestHost(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const raw = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    return raw.split(",")[0]!.trim().replace(/:443$/, "");
  } catch {
    return "";
  }
}

function isLocalHost(host: string): boolean {
  return host === "" || host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

/** URI de redireccion de Google. */
export async function googleRedirectUri(): Promise<string> {
  const { setting } = await import("./settings");
  const { url } = await import("./http");
  const configured = (await setting("google_redirect_uri", "")) || getConfig().google.redirectUri;
  return configured !== "" ? configured : url("api/auth?action=google_callback");
}

/** URL de autorizacion de Google. */
export async function googleAuthUrl(state: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: await googleClientId(),
    redirect_uri: await googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** Intercambia el codigo por un token de acceso. */
export async function googleExchangeCode(code: string): Promise<string | null> {
  const body = new URLSearchParams({
    code,
    client_id: await googleClientId(),
    client_secret: await googleClientSecret(),
    redirect_uri: await googleRedirectUri(),
    grant_type: "authorization_code",
  });
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: body.toString(),
    });
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

/** Obtiene los datos del usuario desde Google. */
export async function googleUserinfo(
  accessToken: string,
): Promise<{ sub: string; email: string; name?: string; picture?: string } | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!data || typeof data["email"] !== "string") return null;
    return {
      sub: String(data["sub"] ?? ""),
      email: String(data["email"]),
      name: typeof data["name"] === "string" ? data["name"] : "",
      picture: typeof data["picture"] === "string" ? data["picture"] : "",
    };
  } catch {
    return null;
  }
}

/** Busca o crea el usuario de Google. Devuelve su id. */
export async function googleFindOrCreate(info: {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}): Promise<number> {
  const email = info.email.toLowerCase();
  let user = await prisma.user.findFirst({ where: { googleId: info.sub }, select: USER_SELECT });
  if (!user) user = await prisma.user.findUnique({ where: { email }, select: USER_SELECT });

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId: info.sub,
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        avatarUrl: info.picture || user.avatarUrl,
        status: user.status === "pending" ? "active" : user.status,
        updatedAt: new Date(),
      },
    });
    return user.id;
  }

  const created = await prisma.user.create({
    data: {
      email,
      name: info.name ?? "",
      passwordHash: null,
      role: (await authIsFirstUser()) ? "admin" : "user",
      status: "active",
      emailVerifiedAt: new Date(),
      googleId: info.sub,
      avatarUrl: info.picture ?? "",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  return created.id;
}
