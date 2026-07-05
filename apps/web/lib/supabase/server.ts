// Client Supabase SSR côté serveur (RSC / Server Actions / Route Handlers).
// Lié aux cookies de la requête (next/headers) → PORTE LE JWT de l'utilisateur :
// toute lecture/écriture passe la RLS sur le vrai chemin (jamais de service_role).
//
// C2.5 / archi ch.2.1 + DA7 : cookies/JWT/Next vivent EXCLUSIVEMENT dans apps/web.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@app/db";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Fabrique un client Supabase authentifié via les cookies de session. Le type
 * retourné est `SupabaseClient<Database>` (= `DbClient` de @app/db).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Appelé depuis un Server Component (cookies en lecture seule) :
          // le middleware `updateSession` se charge du rafraîchissement.
        }
      },
    },
  });
}
