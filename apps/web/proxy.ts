import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";
import { buildCsp, supabaseOrigin } from "./lib/security/csp";

// Routes cron (Vercel Cron) : déclenchées par la plateforme, JAMAIS par un
// navigateur — elles n'ont aucune session utilisateur par construction. Les
// soumettre à la garde d'authentification les redirigeait vers /login (307),
// donc le Route Handler n'était jamais atteint et aucune occurrence récurrente
// n'était générée. Leur authentification est assurée par `CRON_SECRET`
// (`isAuthorizedCronRequest`, fail-closed) dans le Route Handler lui-même.
// Préfixe volontairement étroit : seul `/api/cron/**` sort de la garde.
const CRON_PATH_PREFIX = "/api/cron/";

function isCronRoute(pathname: string): boolean {
  return pathname === "/api/cron" || pathname.startsWith(CRON_PATH_PREFIX);
}

// Rafraîchit la session Supabase à chaque navigation et protège les routes
// (redirect /login si non authentifié). Le matcher exclut les assets statiques.
// Convention Next 16 : middleware.ts renommé proxy.ts (pur renommage, doc officielle
// "Migration to Proxy" — https://nextjs.org/docs/app/api-reference/file-conventions/proxy).
//
// Pose aussi la CSP (nonce par requête, audit sécurité M1, 2026-07-13) : header
// posé ici plutôt que next.config.ts `headers()` car le nonce doit être généré
// à chaque requête.
export async function proxy(request: NextRequest) {
  // Laisse passer le cron sans garde de session ni CSP (réponse JSON, pas de HTML).
  if (isCronRoute(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

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
