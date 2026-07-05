// Seam `getCurrentContext()` — LE SEUL point autorisé à connaître cookies/JWT/Next
// (archi ch.2.1 + DA7). Résout le client authentifié via les cookies de session,
// délègue la résolution member/foyer à `resolveContext` (pur), et redirige vers
// /login si non authentifié ou non provisionné.

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../supabase/server";
import { resolveContext, type Context } from "./resolve";

export type { Context, SessionMember, ResolvedContext } from "./resolve";

/**
 * Contexte authentifié pour un RSC ou une Server Action. Ne retourne jamais un
 * état non authentifié : `redirect('/login')` court-circuite le flux le cas échéant.
 */
export async function getCurrentContext(): Promise<Context> {
  const supabase = await createSupabaseServerClient();
  const resolved = await resolveContext(supabase);
  if (!resolved) redirect("/login");
  return { supabase, ...resolved };
}
