"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * ============================================================================
 *  PESTANAS DE AJUSTES  (mismo comportamiento que el script de settings.php)
 *  Muestra la seccion elegida sin recargar y recuerda la ultima en #ancla.
 *  Los paneles vienen renderizados por el servidor con .tabs__panel; aqui solo
 *  se conmuta la clase .is-active, igual que hacia el script original.
 * ============================================================================
 */

const TABS: Array<[string, string]> = [
  ["general", "General"],
  ["textos", "Textos"],
  ["contacto", "Contacto"],
  ["correo", "Correo"],
  ["resenas", "Reseñas"],
  ["aportaciones", "Aportaciones"],
  ["seguridad", "Seguridad"],
  ["google", "Google"],
  ["rutas", "Rutas"],
];

export function SettingsTabs({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>(".tabs__btn"));
    const panels = Array.from(root.querySelectorAll<HTMLElement>(".tabs__panel"));

    function activate(name: string) {
      for (const b of buttons) {
        const on = b.dataset.tab === name;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      }
      for (const p of panels) {
        p.classList.toggle("is-active", p.dataset.panel === name);
      }
    }

    const onClick = (ev: Event) => {
      const btn = ev.currentTarget as HTMLButtonElement;
      const name = btn.dataset.tab ?? "general";
      activate(name);
      if (window.history.replaceState) window.history.replaceState(null, "", "#" + name);
    };
    buttons.forEach((b) => b.addEventListener("click", onClick));

    const initial = (window.location.hash || "").replace("#", "");
    if (initial && TABS.some(([key]) => key === initial)) activate(initial);

    return () => buttons.forEach((b) => b.removeEventListener("click", onClick));
  }, []);

  return (
    <div className="tabs" data-tabs ref={rootRef}>
      <div className="tabs__nav" role="tablist" aria-label="Secciones de ajustes">
        {TABS.map(([key, label], i) => (
          <button
            key={key}
            type="button"
            role="tab"
            className={`tabs__btn ${i === 0 ? "is-active" : ""}`}
            data-tab={key}
            aria-selected={i === 0}
          >
            {label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
