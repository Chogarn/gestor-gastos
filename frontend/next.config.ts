import type { NextConfig } from "next";

// El navegador siempre habla con este servidor (/api/...) y Next reenvía la petición
// al backend. Así la cookie de sesión es de un único origen y no hace falta CORS.
// Se evalúa al hacer `next build`, por eso en Docker se pasa como argumento de build.
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:5000";

const isDev = process.env.NODE_ENV === "development";

// CSP sin nonces (ver la guía de CSP en node_modules/next/dist/docs): los nonces obligan a
// renderizar todas las páginas de forma dinámica. 'unsafe-inline' en scripts hace falta por
// el script del tema en app/layout.tsx y los scripts inline de Next; aun así se bloquea
// cargar código de otros orígenes y mandar datos fuera (connect-src/form-action).
// 'unsafe-eval' solo en desarrollo: React lo usa para reconstruir las trazas de error.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Equivalente a frame-ancestors para navegadores antiguos: nadie puede meter la app en un iframe
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // No anunciar "X-Powered-By: Next.js"
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
