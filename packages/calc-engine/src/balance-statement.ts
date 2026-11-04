import type { MemberId, SharePct } from "./types";
import { computeShares } from "./shares";
import { contribution } from "./balance";
import type { BalanceExpense, SettlementForBalance } from "./balance";

/**
 * Une dépense de la période, pour le relevé : la vue solde habituelle
 * (`BalanceExpense`, parts figées) + le ratio de partage (% figés), qui sert
 * à exprimer la part de chacun sur le BRUT, avant toute aide.
 */
export type StatementExpense = BalanceExpense & { ratio: SharePct[] };

/**
 * Relevé de l'écart du point de vue d'un membre, sur une période (écran
 * « d'où vient l'écart »). Des lignes dont la somme vaut EXACTEMENT ce que
 * `computeBalance` donne pour ce membre sur les mêmes entrées (corrections
 * comprises, cf. `computeBalanceDelta`). Montants
 * signés : positif = on doit davantage à ce membre.
 *
 * - `expensesCents` : ce qu'il a payé − sa part du brut (ratio seul, comme
 *   s'il n'y avait aucune aide) ;
 * - `aidsCents` : ce que les aides changent à cet écart ;
 * - `settlementsCents` : effet des versements confirmés de la période ;
 * - `correctionsCents` : effet des corrections faites après le dernier
 *   règlement sur des dépenses qu'il couvrait (`computeBalanceDelta`).
 */
export interface BalanceStatement {
  paidCents: number;
  grossShareCents: number;
  expensesCents: number;
  aidReceivedCents: number;
  aidOtherCents: number;
  aidsCents: number;
  settlementsCents: number;
  correctionsCents: number;
  totalCents: number;
}

/**
 * Décompose le solde d'un membre en relevé (dépenses, aides, versements,
 * corrections).
 * Reformulation du calcul canonique, pas un second calcul (DA4) :
 * - la part sur le brut passe par `computeShares` (même règle d'arrondi) ;
 * - la ligne « aides » est obtenue PAR DIFFÉRENCE avec `contribution()` (parts
 *   figées), ce qui garantit une somme exacte au centime, arrondis compris ;
 * - la ligne « versements » suit la convention de `computeBalance` (vérifiée
 *   par le test d'invariant).
 */
export function computeBalanceStatement(input: {
  memberId: MemberId;
  expenses: StatementExpense[];
  settlements: SettlementForBalance[];
  /** Effets par membre (`computeBalanceDelta`) des corrections postérieures. */
  corrections?: Record<MemberId, number>[];
}): BalanceStatement {
  const { memberId, settlements, corrections = [] } = input;
  const expenses = input.expenses.filter((e) => e.deletedAt == null);

  let paidCents = 0;
  let grossShareCents = 0;
  let contributionCents = 0;
  let aidReceivedCents = 0;
  let aidOtherCents = 0;

  for (const e of expenses) {
    if (e.payerId === memberId) paidCents += e.grossCents;
    grossShareCents +=
      computeShares(e.grossCents, e.ratio, e.payerId).find((s) => s.memberId === memberId)?.cents ??
      0;
    contributionCents += contribution(e, memberId);
    for (const aid of e.effectiveAids) {
      if (aid.beneficiaryId === memberId) aidReceivedCents += aid.effectiveCents;
      else aidOtherCents += aid.effectiveCents;
    }
  }

  const expensesCents = paidCents - grossShareCents;
  const aidsCents = contributionCents - expensesCents;
  // Effet des règlements confirmés, même convention que `computeBalance` :
  // celui qui verse voit son solde monter, celui qui reçoit le voit baisser.
  const settlementsCents = settlements
    .filter((s) => s.status === "confirmed")
    .reduce(
      (sum, s) =>
        sum +
        (s.fromMemberId === memberId ? s.amountCents : 0) -
        (s.toMemberId === memberId ? s.amountCents : 0),
      0,
    );
  const correctionsCents = corrections.reduce((sum, delta) => sum + (delta[memberId] ?? 0), 0);

  return {
    paidCents,
    grossShareCents,
    expensesCents,
    aidReceivedCents,
    aidOtherCents,
    aidsCents,
    settlementsCents,
    correctionsCents,
    totalCents: expensesCents + aidsCents + settlementsCents + correctionsCents,
  };
}
