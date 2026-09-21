// Lecture PURE des ratios par défaut du foyer, pour pré-remplir le formulaire de
// saisie (spec 8.4). Aucun calcul ici — calc-engine reste seul habilité à calculer
// des parts (archi ch.1.4 / DA4) ; ce module lit juste `membership.default_share_pct`.

import type { DbClient } from "@app/db";
import type { Balance } from "@app/domain-expense";
import { formatAmountEUR } from "@app/shared";

export type MemberShare = { memberId: string; displayName: string; defaultSharePct: number };

/** Nom affiché d'un membre du foyer, ou "" s'il est introuvable — jamais un id brut à l'écran. */
export function memberDisplayName(members: MemberShare[], memberId: string): string {
  return members.find((m) => m.memberId === memberId)?.displayName ?? "";
}

/**
 * Phrase de solde du point de vue du membre courant (spec 8.1, D-UX2) —
 * formule canonique du solde nul comprise. Extrait de `BalanceCard` pour être
 * partagé avec l'écran « d'où vient l'écart » (refonte solde) sans dupliquer
 * ce texte à deux endroits (risque de dérive de copy).
 */
export function formatBalanceMessage(
  balance: Balance,
  members: MemberShare[],
  currentMemberId: string,
): string {
  if (balance.amountCents === 0) return "vous êtes étale";
  const isCreditor = balance.to === currentMemberId;
  const otherId = isCreditor ? balance.from : balance.to;
  const otherName = memberDisplayName(members, otherId);
  const amount = formatAmountEUR(balance.amountCents);
  return isCreditor ? `${otherName} te doit ${amount}` : `tu dois ${amount} à ${otherName}`;
}

/** Sous ce montant (exclusif, en centimes), un solde non nul se dit « presque étale ». */
export const ALMOST_ETALE_THRESHOLD_CENTS = 2000;

/**
 * Titre du solde, règle UNIQUE partagée par la carte d'accueil et le centre du
 * donut (jamais deux copies qui pourraient diverger) : nul → « vous êtes
 * étale » ; non nul sous le seuil absolu → « presque étale » ; sinon le
 * montant exact. Le montant exact reste dit ailleurs (phrase de constat de
 * l'écran d'explication) : ce titre peut rassurer, pas cacher le chiffre.
 */
export function formatBalanceHeadline(
  balance: Balance,
  members: MemberShare[],
  currentMemberId: string,
): string {
  if (balance.amountCents !== 0 && Math.abs(balance.amountCents) < ALMOST_ETALE_THRESHOLD_CENTS) {
    return "presque étale";
  }
  return formatBalanceMessage(balance, members, currentMemberId);
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
