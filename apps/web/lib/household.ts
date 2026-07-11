// Lecture PURE des ratios par défaut du foyer, pour pré-remplir le formulaire de
// saisie (spec 8.4). Aucun calcul ici — calc-engine reste seul habilité à calculer
// des parts (archi ch.1.4 / DA4) ; ce module lit juste `membership.default_share_pct`.

import type { DbClient } from "@app/db";

export type MemberShare = { memberId: string; displayName: string; defaultSharePct: number };

/** Nom affiché d'un membre du foyer, ou "" s'il est introuvable — jamais un id brut à l'écran. */
export function memberDisplayName(members: MemberShare[], memberId: string): string {
  return members.find((m) => m.memberId === memberId)?.displayName ?? "";
}

export async function getDefaultShares(
  supabase: DbClient,
  householdId: string,
): Promise<MemberShare[]> {
  const { data, error } = await supabase
    .from("membership")
    .select("default_share_pct, member(id, display_name)")
    .eq("household_id", householdId);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    memberId: row.member.id,
    displayName: row.member.display_name,
    defaultSharePct: Number(row.default_share_pct),
  }));
}
