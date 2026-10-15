import type { Metadata } from "next";
import { getConfig } from "@/lib/config";

/**
 * ============================================================================
 *  LAYOUT RAIZ
 *  La web publica es HTML/CSS/JS estatico (carpeta public/) y no pasa por aqui.
 *  Este layout solo envuelve el panel (/admin/*) y las paginas de resultado.
 * ============================================================================
 */

export const metadata: Metadata = {
  title: "Panel · C-ROTULUS",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const site = getConfig().siteName;
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="color-scheme" content="light" />
        <link rel="icon" type="image/png" href="/assets/img/favicon.png" />
        <link rel="preload" as="font" type="font/woff2" href="/assets/fonts/PlusJakartaSans-latin.woff2" crossOrigin="anonymous" />
        <link rel="preload" as="font" type="font/woff2" href="/assets/fonts/Inter-latin.woff2" crossOrigin="anonymous" />
      </head>
      <body data-site={site}>{children}</body>
    </html>
  );
}
