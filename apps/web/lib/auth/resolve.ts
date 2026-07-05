// Résolution PURE de l'identité courante à partir d'un client Supabase authentifié.
// AUCUN import Next ici : ce module est appelable en test (node) avec un client
// obtenu par un vrai signInWithPassword. Le wrapping cookies/redirect vit dans
// context.ts (le seul fichier qui connaît Next).
//
// Chaîne (spec ch.2.4, D3) : auth.uid() → member.auth_user_id → membership → household.

import type { DbClient } from "@app/db";

/** Membre courant tel qu'exposé au reste de l'app (jamais l'auth_user_id brut). */
export type SessionMember = { id: string; displayName: string };

/**
 * Contexte authentifié réutilisable par les Server Actions (C3-web en dérivera
 * l'`ExpenseContext { memberId, householdId }` + le repo). Le client PORTE le JWT
 * utilisateur → la RLS s'applique. Aucune fuite Next/cookies dans ce type.
 */
export type Context = {
  supabase: DbClient;
  member: SessionMember;
  householdId: string;
};

/** La partie résolue de `Context` (tout sauf le client, déjà en main). */
export type ResolvedContext = Omit<Context, "supabase">;

/**
 * Résout member + foyer courant via le client authentifié. `getUser()` valide le
 * JWT côté serveur (recommandation @supabase/ssr, plus sûr que `getSession()`).
 * Retourne `null` si non authentifié ou non provisionné (le seam redirige alors).
 *
 * MVP : un seul foyer par utilisateur — on prend l'unique membership. On ne
 * suppose pas davantage.
 */
export async function resolveContext(supabase: DbClient): Promise<ResolvedContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("member")
    .select("id, display_name, membership(household_id)")
    .eq("auth_user_id", user.id)
    .single();

  const householdId = data?.membership[0]?.household_id;
  if (!data || !householdId) return null;

  return {
    member: { id: data.id, displayName: data.display_name },
    householdId,
  };
}
