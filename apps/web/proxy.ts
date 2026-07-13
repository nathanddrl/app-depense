import type { NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";
import { buildCsp, supabaseOrigin } from "./lib/security/csp";

// Rafraîchit la session Supabase à chaque navigation et protège les routes
// (redirect /login si non authentifié). Le matcher exclut les assets statiques.
// Convention Next 16 : middleware.ts renommé proxy.ts (pur renommage, doc officielle
// "Migration to Proxy" — https://nextjs.org/docs/app/api-reference/file-conventions/proxy).
//
// Pose aussi la CSP (nonce par requête, audit sécurité M1, 2026-07-13) : header
// posé ici plutôt que next.config.ts `headers()` car le nonce doit être généré
// à chaque requête.
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, supabaseOrigin());

  const response = await updateSession(request, nonce);
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: [
    // Toutes les routes SAUF les assets Next et les fichiers statiques courants.
    // `manifest.webmanifest` doit rester accessible sans session (critère
    // d'installabilité PWA vérifié par le navigateur avant tout login, T-CP1.1).
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
