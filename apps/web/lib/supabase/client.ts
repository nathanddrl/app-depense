// Client Supabase SSR côté navigateur (composants clients). Utilise les mêmes
// cookies de session que le client serveur. Fourni pour C3-web (UI optimiste) ;
// le login C2.5 passe par une Server Action, pas par ce client.

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@app/db";

/** Client Supabase authentifié côté navigateur (= `DbClient` de @app/db). */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
