import type { NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

// Rafraîchit la session Supabase à chaque navigation et protège les routes
// (redirect /login si non authentifié). Le matcher exclut les assets statiques.
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Toutes les routes SAUF les assets Next et les fichiers statiques courants.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
