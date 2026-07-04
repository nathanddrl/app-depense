// @app/calc-engine — baril public. SEULE source de vérité du calcul d'Étale
// (archi ch.1.4 / DA4) : répartition des parts (4.3), pipeline aide→net (4.1/4.4),
// solde (4.2). Fonctions pures, zéro I/O, aucune dépendance domain-*/db.

export type { MemberId, SharePct, AidInput, Share, EffectiveAid, CalcWarning } from "./types";
export { CalcPreconditionError } from "./types";

export { computeShares } from "./shares";
export { computeExpense } from "./expense";
export type { ExpenseInput, ComputedExpense } from "./expense";
export { contribution, computeBalance, reduceBalanceTwoMembers } from "./balance";
export type { BalanceExpense, TwoMemberBalance } from "./balance";
