import type { ReactNode } from "react";

/**
 * ============================================================================
 *  COMPONENTES DE UI DEL PANEL
 *  Reproducen las clases de admin.css que usaba el backend PHP, de modo que
 *  el aspecto es identico sin tocar la hoja de estilos.
 * ============================================================================
 */

export function Alert({ kind, children }: { kind: "ok" | "error" | "info"; children: ReactNode }) {
  return <div className={`alert alert--${kind}`}>{children}</div>;
}

/** Muestra el aviso de exito/error que llega por la URL (?ok= / ?err=). */
export function Flash({ ok, err }: { ok: string; err: string }) {
  if (ok) return <Alert kind="ok">{ok}</Alert>;
  if (err) return <Alert kind="error">{err}</Alert>;
  return null;
}

export function Stat({ num, label }: { num: ReactNode; label: string }) {
  return (
    <div className="stat">
      <div className="stat__num">{num}</div>
      <div className="stat__label">{label}</div>
    </div>
  );
}

export function Cards({ children }: { children: ReactNode }) {
  return <div className="cards">{children}</div>;
}

/** Badge de estado con el color que ya definia admin.css. */
export function Badge({ tone, children }: { tone: "nuevo" | "leido" | "archivado"; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

/** Traduce un estado a su tono de color. */
export function statusTone(status: string): "nuevo" | "leido" | "archivado" {
  if (status === "nuevo" || status === "pendiente") return "nuevo";
  if (status === "aprobada" || status === "active" || status === "leido") return "leido";
  return "archivado";
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <p className="muted">{hint}</p> : null}
    </div>
  );
}
