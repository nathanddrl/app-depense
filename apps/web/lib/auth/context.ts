// Seam `getCurrentContext()` — LE SEUL point autorisé à connaître cookies/JWT/Next
// (archi ch.2.1 + DA7). Résout le client authentifié via les cookies de session,
// délègue la résolution member/foyer à `resolveContext` (pur), et redirige vers
// /login si non authentifié ou non provisionné.

import { redirect } from "next/navigation";
import { err, type ActionResult } from "@app/shared";
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

/** Vérité unique du contrôle de rôle admin — réutilisée par le layout et `requireAdmin`. */
export function isAdmin(ctx: Pick<Context, "role">): boolean {
  return ctx.role === "admin";
}

/**
 * Revérification serveur pour toute Server Action admin (le layout ne suffit
 * pas : un appel direct doit être refusé de la même façon). À appeler en tête
 * de la Server Action : `const forbidden = requireAdmin(ctx); if (forbidden) return forbidden;`.
 */
export function requireAdmin(ctx: Pick<Context, "role">): ActionResult<never> | null {
  return isAdmin(ctx) ? null : err("FORBIDDEN", "Réservé aux administrateurs.");
}
