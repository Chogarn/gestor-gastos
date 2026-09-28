import type { NextConfig } from "next";

// El navegador siempre habla con este servidor (/api/...) y Next reenvía la petición
// al backend. Así la cookie de sesión es de un único origen y no hace falta CORS.
// Se evalúa al hacer `next build`, por eso en Docker se pasa como argumento de build.
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:5000";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
