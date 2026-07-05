// @app/domain-aid — DTOs et entrées du domaine « aide rattachée à une dépense »
// (spec ch.5.2, D9/D10). Types de contour, sérialisables, indépendants de
// `domain-expense` (garde ESLint anti-cross-domain — pas de réutilisation directe
// malgré la ressemblance, cf. commentaire dans `expense-repository.ts` sur les
// « deux vues du même schéma »).

/**
 * Identité résolue par le seam `getCurrentContext()` et injectée par `actions.ts`.
 * Le domaine ne touche jamais aux cookies/session : il reçoit l'acteur
 * (`memberId`) et le foyer courant (scope autoritaire, jamais fourni par le client).
 */
export type AidContext = { memberId: string; householdId: string };

/** Entrée de rattachement d'une aide (spec ch.5.2). */
export type AddAidInput = {
  expenseId: string;
  label: string;
  beneficiaryId: string;
  amountCents: number;
};

/** Entrée de retrait d'une aide. */
export type RemoveAidInput = { expenseId?: string; aidId: string };

/** Une aide rattachée à une dépense (une ligne de la table `aid`, D9/D10). */
export type AidDTO = {
  id: string;
  beneficiaryId: string;
  label: string;
  amountCents: number;
};

/** Une part figée persistée (snapshot centimes + % appliqué, D1 / 3.2). */
export type ExpenseShareDTO = { memberId: string; cents: number; pctSnapshot: number };

/** Dépense recalculée telle que restituée par `addAid`/`removeAid`. */
export type Expense = {
  id: string;
  householdId: string;
  grossCents: number;
  payerId: string;
  settlementId: string | null;
  shares: ExpenseShareDTO[];
  aids: AidDTO[];
};
