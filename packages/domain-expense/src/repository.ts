// @app/domain-expense — PORT de persistance (inversion de dépendance).
//
// Le domaine définit l'interface dont il a besoin ; il ne connaît ni Supabase ni
// les cookies. L'implémentation concrète `SupabaseExpenseRepository` vivra dans
// @app/db (post-C2.5) et satisfera ce port STRUCTURELLEMENT (typage structurel TS,
// sans `implements` ni import de domain-*) — @app/db reste une feuille. Les tests
// injectent un fake en mémoire. Toutes les opérations sont déjà scopées au foyer
// courant (le repo porte le client authentifié → la RLS s'applique au runtime).

import type {
  RawBalanceExpenseRow,
  Category,
  Expense,
  ExpenseShareDTO,
  ListExpensesFilters,
} from "./types";

/** Champs scalaires d'une dépense à insérer (les parts sont passées à part). */
export type NewExpense = {
  householdId: string;
  label: string;
  category: Category;
  grossCents: number;
  payerId: string;
  incurredOn: string;
  source: string;
  createdBy: string;
};

/** Patch scalaire d'édition (aucun champ = inchangé). */
export type ExpenseScalarPatch = Partial<{
  label: string;
  category: Category;
  grossCents: number;
  payerId: string;
  incurredOn: string;
}>;

/** Vue de lecture d'une dépense stockée, enrichie du soft-delete (verrou/scope). */
export type StoredExpense = Expense & { deletedAt: string | null };

export interface ExpenseRepository {
  /** Ids des membres du foyer (validation contextuelle : payeur/parts ∈ foyer). */
  getHouseholdMemberIds(householdId: string): Promise<string[]>;

  /** Insertion atomique dépense + parts figées (l'impl Supabase utilisera une RPC). */
  insertExpenseWithShares(expense: NewExpense, shares: ExpenseShareDTO[]): Promise<Expense>;

  /** Lecture d'une dépense pour édition/suppression (null si absente/hors périmètre RLS). */
  getExpenseById(expenseId: string): Promise<StoredExpense | null>;

  /** Réécriture atomique des scalaires + nouvelles parts figées (recompute à l'édition). */
  updateExpenseWithShares(
    expenseId: string,
    patch: ExpenseScalarPatch,
    shares: ExpenseShareDTO[],
  ): Promise<Expense>;

  /** Soft delete (`deleted_at`, D2 — jamais de hard delete). */
  softDeleteExpense(expenseId: string): Promise<{ id: string }>;

  /** Historique chronologique décroissant, soft-deleted exclues, filtrable (6.2). */
  listExpenses(householdId: string, filters: ListExpensesFilters): Promise<Expense[]>;

  /** Dépenses actives (soft-deleted exclues) avec aides + statut settlement, pour le solde (4.2). */
  listExpensesForBalance(householdId: string): Promise<RawBalanceExpenseRow[]>;

  /**
   * TOUTES les dépenses du foyer, sans aucun filtre `deleted_at`/`settlement_id`
   * (T-C8.2, DA14 — vue admin brute). Ne réutilise pas `listExpenses` (qui exclut
   * les soft-deleted) pour ne pas complexifier son filtre avec un flag.
   */
  listAllExpensesForAdmin(householdId: string): Promise<StoredExpense[]>;
}
