import "server-only";
import { redirect } from "next/navigation";
import { currentUser, isAdmin, type User } from "./auth";

/**
 * ============================================================================
 *  GUARDIANES DEL PANEL  (puerto de require_login / require_admin)
 * ============================================================================
 */

/** Exige sesion iniciada; si no, redirige al acceso. */
export async function requireLogin(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  return user;
}

/** Exige rol de administrador. */
export async function requireAdmin(): Promise<User> {
  const user = await requireLogin();
  if (user.role !== "admin") redirect("/admin/account");
  return user;
}

/** Comprueba si el usuario actual es admin (sin redirigir). */
export async function adminIsAdmin(): Promise<boolean> {
  const user = await currentUser();
  return user !== null && user.role === "admin";
}
