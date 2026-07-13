import type { NextConfig } from "next";

// Source-exports / packages JIT (archi ch.1.5, DA5) : Next transpile directement
// le TS source des packages @app/*, aucun build de package à consommer.
// @app/config est volontairement EXCLU : outillage (tsconfig/eslint/prettier),
// jamais importé au runtime.
const nextConfig: NextConfig = {
  // Autorise l'accès au serveur de dev depuis un appareil sur le réseau local
  // (sinon Next bloque les requêtes cross-origin — Server Actions, HMR — hors
  // localhost, ce qui peut casser l'hydratation et rendre boutons/nav inertes).
  allowedDevOrigins: process.env.NEXT_ALLOWED_DEV_ORIGINS
    ? process.env.NEXT_ALLOWED_DEV_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
    : [],
  transpilePackages: [
    "@app/calc-engine",
    "@app/domain-expense",
    "@app/domain-aid",
    "@app/domain-settlement",
    "@app/domain-recurrence",
    "@app/db",
    "@app/shared",
  ],
  // Headers de sécurité statiques (audit sécurité M1, 2026-07-13). La CSP
  // (nonce par requête) vit dans middleware.ts, pas ici — headers() est évalué
  // au build, incompatible avec un nonce par requête.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
