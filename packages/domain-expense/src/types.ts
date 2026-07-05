// @app/domain-expense — DTOs et entrées du domaine « dépense ponctuelle » (ch.5.1).
//
// Types de contour, sérialisables. La catégorie réutilise l'enum de la DB (D18) via
// un import de TYPE uniquement (domain→db autorisé, aucun runtime db ici).

import type { Enums } from "@app/db";

/** Catégorie figée (enum DB, D18) : 'loyer'|'courses'|'charges'|'sorties'|'autre'. */
export type Category = Enums<"expense_category">;

/** Une ligne de répartition en % à la saisie (aligné `calc-engine.SharePct` + 6.2). */
export type ShareInput = { memberId: string; pct: number };

/** Une part figée persistée (snapshot centimes + % appliqué, D1 / 3.2). */
export type ExpenseShareDTO = { memberId: string; cents: number; pctSnapshot: number };

/**
 * Identité résolue par le seam `getCurrentContext()` (construit en C2.5) et injectée
 * par `actions.ts`. Le domaine ne touche jamais aux cookies/session : il reçoit
 * l'acteur (`memberId`, pour `created_by`) et le foyer courant (scope autoritaire).
 */
export type ExpenseContext = { memberId: string; householdId: string };

/** Entrée de création (signatures 6.2). Le client n'envoie JAMAIS de montant de part. */
export type CreateExpenseInput = {
  householdId: string;
  label: string;
  category: Category;
  grossCents: number;
  payerId: string;
  incurredOn: string; // date métier `YYYY-MM-DD`
  shares: ShareInput[];
};

/** Patch d'édition (6.2). Tout champ absent = inchangé. Le foyer n'est pas déplaçable. */
export type UpdateExpenseInput = {
  expenseId: string;
  patch: Partial<Omit<CreateExpenseInput, "householdId">>;
};

/** Filtres de l'historique chronologique (6.2). */
export type ListExpensesFilters = { month?: string; category?: Category };

/** Dépense telle que restituée par le domaine (dépense active, non supprimée). */
export type Expense = {
  id: string;
  householdId: string;
  label: string;
  category: Category;
  grossCents: number;
  payerId: string;
  incurredOn: string;
  source: string;
  settlementId: string | null;
  createdAt: string;
  updatedAt: string;
  shares: ExpenseShareDTO[];
};

/** Statut d'un settlement (D-double approbation, ch.5.3). */
export type SettlementStatus = "pending" | "confirmed" | "cancelled";

/** Une aide brute rattachée à une dépense (avant plafond 4.4), avec son libellé. */
export type BalanceAid = { beneficiaryId: string; amountCents: number; label: string };

/**
 * Vue d'une dépense active pour le calcul du solde (spec 4.2). Le statut du
 * settlement rattaché (`null` si aucun) permet au domaine d'appliquer le filtre
 * « seul un settlement confirmé exclut la dépense ». `label` sert au détail de
 * transparence dépliable (8.3, T-C4.4).
 */
export type BalanceExpenseRow = {
  label: string;
  grossCents: number;
  payerId: string;
  shares: { memberId: string; cents: number; pctSnapshot: number }[];
  aids: BalanceAid[];
  settlementStatus: SettlementStatus | null;
};

/** Solde courant réduit à deux membres (6.2 `getBalance`). */
export type Balance = {
  from: string;
  to: string;
  amountCents: number;
  pendingSettlement?: boolean;
};

/** Une ligne d'ajustement « aide » du détail dépliable (spec 8.3, 2e temps). */
export type BalanceDetailAidLine = {
  label: string;
  beneficiaryId: string;
  aidCents: number;
  sharedCents: number;
};

/**
 * Décomposition d'une dépense contributive au solde, en données brutes (aucune
 * phrase construite ici — le langage humain vit dans la couche web, 8.1/8.3).
 */
export type BalanceDetailLine = {
  label: string;
  grossCents: number;
  payerId: string;
  otherId: string;
  baseOwedCents: number;
  aidLines: BalanceDetailAidLine[];
  totalOwedCents: number;
};
