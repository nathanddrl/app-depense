import type { EffectiveAid, MemberId } from "./types";

export interface BalanceExpense {
  grossCents: number;
  payerId: MemberId;
  shares: { memberId: MemberId; cents: number }[];
  effectiveAids: EffectiveAid[];
  /** Filtre 4.2 : une dépense soft-deletée ne compte pas dans le solde. */
  deletedAt?: Date | string | null;
  /** Filtre 4.2 : seul un settlement `confirmed` exclut la dépense du solde. */
  settlementConfirmed?: boolean;
}

export interface TwoMemberBalance {
  from: MemberId;
  to: MemberId;
  amountCents: number;
}

/**
 * Contribution d'un membre sur UNE dépense (spec 4.2) :
 *   contribution(m) = payé(m) − aide_perçue(m) − part(m)
 * - payé(m)   = charge brute si m est le payeur, sinon 0.
 * - aide_perçue(m) = Σ des aides effectives dont m est bénéficiaire.
 * - part(m)   = share_cents de m (0 s'il n'a pas de part).
 */
export function contribution(expense: BalanceExpense, memberId: MemberId): number {
  const paid = expense.payerId === memberId ? expense.grossCents : 0;
  const aid = expense.effectiveAids
    .filter((a) => a.beneficiaryId === memberId)
    .reduce((s, a) => s + a.effectiveCents, 0);
  const part = expense.shares
    .filter((s) => s.memberId === memberId)
    .reduce((s, x) => s + x.cents, 0);
  return paid - aid - part;
}

/** Une dépense entre dans le solde si non supprimée ET non régularisée de façon confirmée (4.2). */
function countsInBalance(expense: BalanceExpense): boolean {
  return expense.deletedAt == null && expense.settlementConfirmed !== true;
}

/**
 * Solde net de chaque membre (spec 4.2), somme des contributions sur les dépenses
 * éligibles. Propriété garantie : `Σ_m solde(m) = 0` (cf. property test).
 */
export function computeBalance(
  expenses: BalanceExpense[],
  memberIds: MemberId[],
): Record<MemberId, number> {
  const eligible = expenses.filter(countsInBalance);
  const balances: Record<MemberId, number> = {};
  for (const id of memberIds) {
    balances[id] = eligible.reduce((sum, e) => sum + contribution(e, id), 0);
  }
  return balances;
}

/**
 * Réduction d'affichage pour un foyer à 2 membres (spec 4.2) : « X doit |solde| à Y ».
 * Retourne `null` si le solde est nul (rien à régulariser).
 * `from` = débiteur (solde négatif), `to` = créancier (solde positif).
 */
export function reduceBalanceTwoMembers(
  balances: Record<MemberId, number>,
): TwoMemberBalance | null {
  const entries = Object.entries(balances);
  const creditor = entries.find(([, v]) => v > 0);
  const debtor = entries.find(([, v]) => v < 0);
  if (!creditor || !debtor) return null;
  return { from: debtor[0], to: creditor[0], amountCents: creditor[1] };
}
