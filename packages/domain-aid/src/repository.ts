// @app/domain-aid — PORT de persistance (inversion de dépendance).
//
// Le domaine définit l'interface dont il a besoin ; il ne connaît ni Supabase ni
// les cookies. L'implémentation concrète `SupabaseAidRepository` vit dans `@app/db`
// et satisfait ce port STRUCTURELLEMENT (typage structurel TS, sans `implements`
// ni import de domain-*) — `@app/db` reste une feuille. Les tests injectent un fake
// en mémoire. Toutes les opérations sont déjà scopées au foyer courant (le repo
// porte le client authentifié → la RLS s'applique au runtime).

import type { AidDTO, Expense, ExpenseShareDTO } from "./types";

/** Champs scalaires d'une aide à insérer. */
export type NewAid = {
  expenseId: string;
  beneficiaryId: string;
  label: string;
  amountCents: number;
};

/**
 * Vue d'une dépense nécessaire pour rattacher/retirer une aide : le brut, le
 * payeur, le verrou de settlement, le ratio (dérivé des `expense_share.pctSnapshot`
 * existants — jamais ressaisi) et les aides déjà rattachées.
 */
export type ExpenseForAid = {
  id: string;
  householdId: string;
  grossCents: number;
  payerId: string;
  settlementId: string | null;
  ratio: { memberId: string; pct: number }[];
  aids: AidDTO[];
};

export interface AidRepository {
  /** Ids des membres du foyer (validation contextuelle : bénéficiaire ∈ foyer). */
  getHouseholdMemberIds(householdId: string): Promise<string[]>;

  /** Lecture d'une dépense pour rattacher/retirer une aide (null si hors périmètre RLS). */
  getExpenseForAid(expenseId: string): Promise<ExpenseForAid | null>;

  /** Résout l'aide vers sa dépense parente (null si absente/hors périmètre RLS). */
  getAidById(aidId: string): Promise<{ id: string; expenseId: string } | null>;

  /** Insertion de l'aide + réécriture des parts figées (recompute, spec 4.1/4.4). */
  addAid(newAid: NewAid, shares: ExpenseShareDTO[]): Promise<Expense>;

  /** Retrait de l'aide + réécriture des parts figées (recompute). */
  removeAid(aidId: string, shares: ExpenseShareDTO[]): Promise<Expense>;
}
