import type { NextConfig } from "next";

// Source-exports / packages JIT (archi ch.1.5, DA5) : Next transpile directement
// le TS source des packages @app/*, aucun build de package à consommer.
// @app/config est volontairement EXCLU : outillage (tsconfig/eslint/prettier),
// jamais importé au runtime.
const nextConfig: NextConfig = {
  // Autorise l'accès au serveur de dev depuis un appareil sur le réseau local
  // (sinon Next bloque les requêtes cross-origin — Server Actions, HMR — hors
  // localhost, ce qui peut casser l'hydratation et rendre boutons/nav inertes).
  allowedDevOrigins: ["192.168.1.38"],
  transpilePackages: [
    "@app/calc-engine",
    "@app/domain-expense",
    "@app/domain-aid",
    "@app/domain-settlement",
    "@app/domain-recurrence",
    "@app/db",
    "@app/shared",
  ],
};

export default nextConfig;
