import type { ReactNode } from "react";
import Link from "next/link";
import { getConfig } from "@/lib/config";

/**
 * ============================================================================
 *  MARCO DE LAS PAGINAS DE ACCESO  (admin_auth_page / admin_auth_footer)
 *  Dos columnas: panel de marca a la izquierda y tarjeta del formulario a la
 *  derecha. Identico al backend PHP (mismas clases de admin.css).
 * ============================================================================
 */

export function AuthShell({
  bullets,
  children,
}: {
  bullets: string[];
  children: ReactNode;
}) {
  const site = getConfig().siteName;
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <div className="auth-aside__inner">
          <Link className="auth-aside__logo" href="/index.html">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/img/logo-header.png" alt={site} />
          </Link>
          <h2>
            Tecnología clara
            <br />
            que hace crecer tu negocio
          </h2>
          <p>
            Área privada de C-ROTULUS para gestionar el contenido del sitio y los
            mensajes de tus clientes.
          </p>
          <ul>
            {bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="auth-aside__back">
            <a href="/index.html">&larr; Volver a la web</a>
          </p>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-brand-mobile">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/img/logo-header.png" alt={site} />
          </div>
          {children}
        </div>
      </main>
      <script src="/admin/assets/admin-auth.js" defer />
    </div>
  );
}

/** Boton "Continuar con Google" (activo o con aviso si falta configuracion). */
export function GoogleButton({ enabled }: { enabled: boolean }) {
  const inner = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
        alt=""
        width={18}
        height={18}
      />
      Continuar con Google
    </>
  );

  return (
    <>
      <div className="sep">o</div>
      <a
        className={`btn-google${enabled ? "" : " is-muted"}`}
        href="/api/auth?action=google_start"
        data-google-start
        {...(enabled ? { "data-google-ok": "1" } : { "data-google-off": "1" })}
        title={enabled ? undefined : "Añade el Client ID y el Client secret de Google en Ajustes para activarlo"}
      >
        {inner}
      </a>
      <div className="alert alert--info" id="googleNotice" role="status" hidden />
    </>
  );
}

/** Enlace de error bajo un campo, para el JS de validacion. */
export function FieldError({ name }: { name: string }) {
  return <span className="field__hint" data-error-for={name} hidden />;
}
