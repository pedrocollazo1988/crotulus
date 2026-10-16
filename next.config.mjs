/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // El sitio publico sigue siendo HTML/CSS/JS estatico (carpeta public/).
  // Las reescrituras hacen dos cosas:
  //   1) URLs "limpias" equivalentes a las del .htaccess (/, /empresa).
  //   2) Compatibilidad con las rutas .php del backend anterior: js/main.js
  //      sigue llamando a api/index?..., api/contact.php y admin/login.php,
  //      y aqui se redirigen a los route handlers / paginas de Next.
  async rewrites() {
    return [
      // --- URLs limpias del sitio publico ---
      { source: "/", destination: "/index.html" },
      { source: "/empresa", destination: "/empresa.html" },

      // --- API publica (antes api/*.php) ---
      { source: "/api/index.php", destination: "/api/index" },
      { source: "/api/contact.php", destination: "/api/contact" },
      { source: "/api/auth.php", destination: "/api/auth" },
      { source: "/api/reviews.php", destination: "/api/reviews" },
      { source: "/api/submissions.php", destination: "/api/submissions" },
      { source: "/api/verify.php", destination: "/api/verify" },
      { source: "/api/logout.php", destination: "/api/logout" },

      // --- Panel (antes admin/*.php) ---
      { source: "/admin/", destination: "/admin" },
      { source: "/admin/index.php", destination: "/admin" },
      { source: "/admin/login.php", destination: "/admin/login" },
      { source: "/admin/logout", destination: "/api/logout" },
      { source: "/admin/logout.php", destination: "/api/logout" },
      { source: "/admin/register.php", destination: "/admin/register" },
      { source: "/admin/forgot.php", destination: "/admin/forgot" },
      { source: "/admin/reset.php", destination: "/admin/reset" },
      { source: "/admin/account.php", destination: "/admin/account" },
      { source: "/admin/content.php", destination: "/admin/content" },
      { source: "/admin/blog.php", destination: "/admin/blog" },
      { source: "/admin/team.php", destination: "/admin/team" },
      { source: "/admin/reviews.php", destination: "/admin/reviews" },
      { source: "/admin/submissions.php", destination: "/admin/submissions" },
      { source: "/admin/settings.php", destination: "/admin/settings" },
      { source: "/admin/users.php", destination: "/admin/users" },
    ];
  },

  async headers() {
    // CSP: el sitio es propio; se permiten el widget de chat (creatuagente),
    // el iframe de Google Maps y los estilos en linea de los JSON-LD. Se evita
    // 'unsafe-eval' y los scripts de terceros no declarados.
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' https://api.creatuagente.io" +
        (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
      "connect-src 'self' https://api.creatuagente.io",
      "frame-src 'self' https://www.google.com https://maps.google.com",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Content-Security-Policy", value: csp },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
