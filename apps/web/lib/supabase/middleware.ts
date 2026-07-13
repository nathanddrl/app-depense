// Rafraîchissement de session Supabase dans le middleware Next (pattern standard
// @supabase/ssr). Recrée un client lié aux cookies request/response, appelle
// getUser() pour rafraîchir le token, et redirige vers /login si non authentifié.
//
// IMPORTANT : ne rien exécuter entre `createServerClient` et `getUser()` (risque
// de déconnexions aléatoires — recommandation @supabase/ssr).

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@app/db";

/** Routes publiques (pas de session requise). */
const PUBLIC_PATHS = ["/login"];

// `nonce` : posé sur les headers de requête (`x-nonce`) pour que les Server
// Components (layout.tsx) puissent le lire via `headers()` et l'appliquer au
// script inline `<ThemeScript>`, en cohérence avec la CSP script-src stricte
// posée dans proxy.ts (audit sécurité M1, 2026-07-13).
export async function updateSession(request: NextRequest, nonce: string): Promise<NextResponse> {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
