import type { NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

// Rafraîchit la session Supabase à chaque navigation et protège les routes
// (redirect /login si non authentifié). Le matcher exclut les assets statiques.
// Convention Next 16 : middleware.ts renommé proxy.ts (pur renommage, doc officielle
// "Migration to Proxy" — https://nextjs.org/docs/app/api-reference/file-conventions/proxy).
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Toutes les routes SAUF les assets Next et les fichiers statiques courants.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
