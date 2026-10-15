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
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
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
