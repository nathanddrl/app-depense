// @app/domain-settlement — types du domaine (spec ch.5.3, D16 v0.3).

/** Statut d'un settlement : double approbation, transitions gardées (transitions.ts). */
export type SettlementStatus = "pending" | "confirmed" | "cancelled";

/** Vue domaine d'un settlement, miroir camelCase de la table `settlement`. */
export type Settlement = {
  id: string;
  householdId: string;
  status: SettlementStatus;
  amountCents: number;
  fromMemberId: string;
  toMemberId: string;
  initiatedBy: string;
  initiatedAt: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
};

/**
 * Identité résolue par le seam `getCurrentContext()` et injectée par
 * `actions.ts` — même forme que `ExpenseContext`/`AidContext` (dupliquée par
 * design, garde anti-cross-domain ch.1.4/DA4).
 */
export type SettlementContext = { memberId: string; householdId: string };

/**
 * Entrée de `initiateSettlement` (T-C6.2). Le solde (`fromMemberId`/`toMemberId`/
 * `amountCents`) est calculé par l'appelant via `domain-expense.getBalance` — un
 * domaine n'important jamais un autre domain-* (DA4), cette composition vit à la
 * couche au-dessus (Server Action), jamais recalculée ici.
 */
export type InitiateSettlementInput = {
  householdId: string;
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
};
