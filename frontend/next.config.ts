import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

// Adresses de l'API appelée depuis le navigateur (espaces candidat, examinateur,
// surveillant) : seules origines externes autorisées pour les requêtes du site.
const originesApi = [
  process.env.NEXT_PUBLIC_API_URL,
  process.env.NEXT_PUBLIC_PORTAL_API_URL,
  process.env.NEXT_PUBLIC_API_BASE_URL,
  ...(dev ? ["http://localhost:8000", "http://localhost:8002"] : []),
]
  .map((u) => { try { return u ? new URL(u).origin : null; } catch { return null; } })
  .filter((o, i, t): o is string => !!o && t.indexOf(o) === i);

// Politique de sécurité du contenu : rien ne se charge ni ne s'envoie ailleurs que sur le
// site et son API. 'unsafe-inline' reste nécessaire aux scripts d'amorçage de Next.js ;
// le cadre « blob: » sert à l'aperçu PDF des sujets (espace examinateur).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${originesApi.join(" ")}${dev ? " ws: http://localhost:*" : ""}`,
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // Le site ne peut pas être affiché dans le cadre d'un autre site (clickjacking)
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
