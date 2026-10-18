/**
 * ============================================================================
 *  VALIDACION Y SANEAMIENTO  (puerto de app/lib/validator.php)
 *  Todo lo que llega del exterior pasa por aqui antes de tocar la base de datos.
 * ============================================================================
 */

/** Quita espacios y caracteres de control. */
export function cleanText(value: unknown): string {
  const s = typeof value === "string" ? value : String(value ?? "");
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "").trim();
}

/** Escapa texto para mostrarlo en HTML (defensa en profundidad contra XSS). */
export function e(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export interface ValidationResult<T> {
  errors: Record<string, string>;
  data: T;
}

/** Normaliza y valida un correo. Devuelve null si no es valido. */
export function normalizeEmail(email: string): string | null {
  const clean = cleanText(email).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) && clean.length <= 190 ? clean : null;
}

/** Comprueba la robustez de una contrasena. */
export function validatePassword(password: string, min: number, max: number): string[] {
  const errors: string[] = [];
  if (password === "") return ["Escribe una contraseña."];
  if ([...password].length < min) errors.push(`La contraseña debe tener al menos ${min} caracteres.`);
  if ([...password].length > max) errors.push(`La contraseña no puede superar los ${max} caracteres.`);
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/u.test(password)) errors.push("Incluye al menos una letra.");
  if (!/\d/.test(password)) errors.push("Incluye al menos un número.");
  return errors;
}

/** Comprueba el nombre de una persona. */
export function validateName(name: string): string[] {
  const clean = cleanText(name);
  const len = [...clean].length;
  if (len < 2) return ["Escribe tu nombre (mínimo 2 caracteres)."];
  if (len > 120) return ["El nombre no puede superar los 120 caracteres."];
  return [];
}

/** Limita el texto a un maximo de caracteres. */
export function limitText(value: string, max: number): string {
  const clean = cleanText(value);
  return [...clean].length > max ? [...clean].slice(0, max).join("") : clean;
}

const ALLOWED_SERVICES = [
  "Desarrollo web y aplicaciones",
  "Automatización y agentes de IA",
  "Soporte técnico",
  "Redes y ciberseguridad",
  "Consultoría tecnológica",
  "Mantenimiento integral",
  "Otro",
];

export interface ContactData {
  name: string;
  email: string;
  phone: string;
  service: string;
  message: string;
}

/** Valida el formulario de contacto (equivalente a validate_contact). */
export function validateContact(data: Record<string, unknown>): ValidationResult<ContactData> {
  const errors: Record<string, string> = {};

  const name = cleanText(data["nombre"]);
  const email = cleanText(data["correo"]);
  const phone = cleanText(data["teléfono"] ?? data["telefono"]);
  const service = cleanText(data["servicio"]);
  const message = cleanText(data["mensaje"]);

  const nameLen = [...name].length;
  if (nameLen < 2 || nameLen > 120) {
    errors["nombre"] = "Escribe tu nombre (entre 2 y 120 caracteres).";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190) {
    errors["correo"] = "Escribe un correo electrónico válido.";
  }
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 25 || !/^[0-9+\s().\-]+$/.test(phone)) {
    errors["teléfono"] = "Escribe un teléfono válido.";
  }
  if (service === "" || !ALLOWED_SERVICES.includes(service)) {
    errors["servicio"] = "Selecciona un servicio.";
  }
  const msgLen = [...message].length;
  if (msgLen < 10 || msgLen > 5000) {
    errors["mensaje"] = "El mensaje debe tener entre 10 y 5000 caracteres.";
  }

  return {
    errors,
    data: { name, email, phone, service, message },
  };
}

export const REVIEW_TARGET_TYPES = ["servicio", "proyecto", "general"] as const;

export interface ReviewData {
  targetType: string;
  targetId: number;
  targetLabel: string;
  rating: number;
  authorName: string;
  authorEmail: string;
  comment: string;
}

/** Valida una valoracion (equivalente a validate_review). */
export function validateReview(data: Record<string, unknown>): ValidationResult<ReviewData> {
  const errors: Record<string, string> = {};

  let targetType = cleanText(data["tipo"] ?? data["target_type"] ?? "general");
  const rating = Number.parseInt(String(data["valoracion"] ?? data["rating"] ?? 0), 10) || 0;
  const name = cleanText(data["nombre"] ?? data["author_name"]);
  const email = cleanText(data["correo"] ?? data["author_email"]);
  const comment = cleanText(data["comentario"] ?? data["comment"]);
  const label = cleanText(data["etiqueta"] ?? data["target_label"]);
  const targetId = Number.parseInt(String(data["destino_id"] ?? data["target_id"] ?? 0), 10) || 0;

  if (!(REVIEW_TARGET_TYPES as readonly string[]).includes(targetType)) targetType = "general";
  if (rating < 1 || rating > 5) errors["valoracion"] = "Elige una puntuación entre 1 y 5 estrellas.";
  const nameLen = [...name].length;
  if (nameLen < 2 || nameLen > 120) errors["nombre"] = "Escribe tu nombre (entre 2 y 120 caracteres).";
  if (email !== "" && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190)) {
    errors["correo"] = "Escribe un correo electrónico válido o déjalo vacío.";
  }
  const commentLen = [...comment].length;
  if (commentLen < 10 || commentLen > 1500) {
    errors["comentario"] = "Cuéntanos tu experiencia (entre 10 y 1500 caracteres).";
  }

  return {
    errors,
    data: {
      targetType,
      targetId: Math.max(0, targetId),
      targetLabel: limitText(label, 200),
      rating: Math.max(1, Math.min(5, rating)),
      authorName: name,
      authorEmail: email,
      comment,
    },
  };
}

export const SUBMISSION_TYPES: Record<string, string> = {
  testimonio: "Testimonio",
  pregunta: "Pregunta frecuente",
};

export interface SubmissionData {
  stype: string;
  title: string;
  body: string;
  authorRole: string;
  rating: number;
  photo: string;
}

/** Valida una aportacion (equivalente a validate_submission). */
export function validateSubmission(data: Record<string, unknown>): ValidationResult<SubmissionData> {
  const errors: Record<string, string> = {};

  const type = cleanText(data["tipo"] ?? "testimonio");
  const title = cleanText(data["titulo"]);
  const body = cleanText(data["texto"] ?? data["comentario"]);
  const authorRole = limitText(cleanText(data["rol"]), 120);

  // Estrellas (1-5). Solo aplica a los testimonios; si falta o no es valida, 5.
  const ratingRaw = cleanText(data["rating"]);
  let rating = Number.parseInt(ratingRaw, 10);
  if (Number.isNaN(rating) || rating < 1 || rating > 5) rating = 5;

  if (!(type in SUBMISSION_TYPES)) errors["tipo"] = "Elige el tipo de aportación.";

  const titleLen = [...title].length;
  const bodyLen = [...body].length;

  if (type === "testimonio") {
    if (titleLen < 2 || titleLen > 120) errors["titulo"] = "Escribe tu nombre (entre 2 y 120 caracteres).";
    if (bodyLen < 10 || bodyLen > 1500) errors["texto"] = "Cuéntanos tu experiencia (entre 10 y 1500 caracteres).";
  } else {
    if (titleLen < 8 || titleLen > 200) errors["titulo"] = "Escribe la pregunta (entre 8 y 200 caracteres).";
    if (bodyLen > 1500) errors["texto"] = "El detalle no puede superar los 1500 caracteres.";
  }

  // Foto opcional: el navegador la envia como data URL JPEG ya recortada y
  // comprimida (~256px). Limite defensivo por si llega algo mayor.
  const photo = sanitizePhotoDataUrl(data["photo"]);

  return { errors, data: { stype: type, title, body, authorRole, rating, photo } };
}

/** Acepta solo una data URL de imagen pequena y valida; si no, la descarta. */
export function sanitizePhotoDataUrl(value: unknown, maxBytes = 400_000): string {
  const v = typeof value === "string" ? value.trim() : "";
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(v);
  if (!m) return "";
  const bytes = Math.floor((m[2].length * 3) / 4);
  return bytes > 0 && bytes <= maxBytes ? v : "";
}

/** Sanea una ruta de imagen (relativa assets/... o URL http(s), sin ".."). */
export function sanitizeImagePath(value: string): string {
  const v = cleanText(value);
  if (v === "") return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (v.includes("..")) return "";
  if (/^[A-Za-z0-9_\-./]+$/.test(v)) return v;
  return "";
}
