import type { ReactNode } from "react";
import Link from "next/link";
import { adminNavCounts } from "@/lib/admin";
import { currentUser } from "@/lib/auth";
import { bootstrap } from "@/lib/bootstrap";
import { getConfig } from "@/lib/config";
import { csrfToken } from "@/lib/csrf";

/**
 * ============================================================================
 *  LAYOUT DEL PANEL  (equivalente a admin_header/admin_footer de bootstrap.php)
 *  Solo se aplica a las paginas de gestion; las de acceso tienen su propio
 *  diseno de dos columnas (admin/(auth)).
 * ============================================================================
 */

const NAV: Array<{ href: string; label: string; adminOnly: boolean }> = [
  { href: "/admin/account", label: "Mi cuenta", adminOnly: false },
  { href: "/admin", label: "Mensajes", adminOnly: true },
  { href: "/admin/content", label: "Contenido", adminOnly: true },
  { href: "/admin/blog", label: "Blog", adminOnly: true },
  { href: "/admin/team", label: "Equipo", adminOnly: true },
  { href: "/admin/reviews", label: "Valoraciones", adminOnly: true },
  { href: "/admin/submissions", label: "Aportaciones", adminOnly: true },
  { href: "/admin/settings", label: "Ajustes", adminOnly: true },
  { href: "/admin/users", label: "Usuarios", adminOnly: true },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await bootstrap();
  const user = await currentUser();

  // Sin sesion: la pagina de acceso se renderiza sin la barra de navegacion.
  if (!user) {
    return (
      <>
        <link rel="stylesheet" href="/admin/assets/admin.css" />
        {children}
      </>
    );
  }

  const counts = await adminNavCounts();
  const isAdmin = user.role === "admin";
  const site = getConfig().siteName;
  const csrf = csrfToken();

  return (
    <>
      <link rel="stylesheet" href="/admin/assets/admin.css" />
      <header className="topbar">
        <div className="topbar__inner">
          <div className="topbar__row">
            <Link className="brand" href="/admin/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="brand__logo" src="/assets/img/logo-header.png" alt={site} />
            </Link>
            <div className="topnav__user">
              <a className="topnav__link" href="/index.html" target="_blank" rel="noopener noreferrer">Ver sitio</a>
              <span className="who">{user.name || user.email}</span>
              <form method="post" action="/api/logout" className="inline">
                <input type="hidden" name="_csrf" value={csrf} />
                <button className="btn-link" type="submit">Salir</button>
              </form>
            </div>
          </div>
          <nav className="topnav" aria-label="Navegación del panel">
            {NAV.filter((l) => isAdmin || !l.adminOnly).map((l) => {
              const count = counts[l.label] ?? 0;
              return (
                <Link key={l.href} href={l.href}>
                  {l.label}
                  {count > 0 ? <span className="nav-badge__count">{count}</span> : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="wrap">{children}</main>
      <footer className="foot">
        &copy; {new Date().getFullYear()} {site} &middot; <a href="/index.html">Volver a la web</a>
      </footer>
    </>
  );
}
