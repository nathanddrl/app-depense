// @app/db — API publique de la couche donnée feuille (archi ch.1.4 / DA3).
// Expose le client Supabase typé et les types générés depuis le schéma.
// N'importe aucun domain-* ni calc-engine (garde ESLint).

export { createDbClient, type DbClient } from "./client";

export { SupabaseExpenseRepository } from "./expense-repository";
export type {
  Category as ExpenseCategory,
  Expense,
  ExpenseScalarPatch,
  ExpenseShareDTO,
  ListExpensesFilters,
  NewExpense,
  StoredExpense,
  BalanceAid,
  BalanceExpenseRow,
  SettlementStatus,
} from "./expense-repository";

export { SupabaseAidRepository } from "./aid-repository";
export type { AidDTO, Expense as AidExpense, ExpenseForAid, NewAid } from "./aid-repository";

export type { Database, Json } from "./database.types";
import type { Database } from "./database.types";

/** Ligne d'une table du schéma public, ex. `Tables<"expense">`. */
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

/** Payload d'insertion d'une table, ex. `TablesInsert<"expense">`. */
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

/** Payload de mise à jour d'une table, ex. `TablesUpdate<"expense">`. */
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

/** Valeur d'un enum du schéma, ex. `Enums<"expense_category">`. */
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
