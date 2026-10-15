import "server-only";
import { compare, hash } from "bcryptjs";

/**
 * ============================================================================
 *  HASH DE CONTRASENAS  (puerto de hash_password / verify_password)
 *  bcrypt con coste 10 (equivalente al PASSWORD_DEFAULT de PHP).
 * ============================================================================
 */

const ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hashed: string | null): Promise<boolean> {
  if (!hashed) return false;
  try {
    return await compare(plain, hashed);
  } catch {
    return false;
  }
}
