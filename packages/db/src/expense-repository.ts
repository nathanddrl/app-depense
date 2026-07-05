// SupabaseExpenseRepository — implémentation concrète du port `ExpenseRepository`
// défini par `@app/domain-expense` (archi ch.1.4 / DA4, C3-web).
//
// `db` reste une couche feuille (garde ESLint `no-restricted-imports` sur
// `@app/domain-*`) : ce fichier n'importe RIEN de `@app/domain-expense`, pas même
// le type du port. Les types ci-dessous ont les mêmes noms de champs que le port
// (voir `packages/domain-expense/src/repository.ts`) mais sont dérivés ici de la
// connaissance que `db` a déjà de son propre schéma (`Tables<"expense">`, etc.) —
// pas d'import externe, donc pas de duplication au sens strict, juste deux vues
// (snake_case DB / camelCase domaine) du même schéma.
//
// La conformité STRUCTURELLE de `SupabaseExpenseRepository` au port n'est vérifiée
// nulle part ici : elle l'est par TypeScript au seul endroit qui importe
// légitimement `@app/db` ET `@app/domain-expense` — `apps/web/app/actions.ts`, à
// l'appel `createExpense(repo, ctx, input)`. Une divergence de shape échoue là,
// jamais dans `db`.

import type { DbClient } from "./client";
import type { Enums, Tables } from "./index";

export type Category = Enums<"expense_category">;

export type ExpenseShareDTO = { memberId: string; cents: number; pctSnapshot: number };

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

export type ExpenseScalarPatch = Partial<{
  label: string;
  category: Category;
  grossCents: number;
  payerId: string;
  incurredOn: string;
}>;

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

export type StoredExpense = Expense & { deletedAt: string | null };

export type ListExpensesFilters = { month?: string; category?: Category };

export type SettlementStatus = Enums<"settlement_status">;
export type BalanceAid = { beneficiaryId: string; amountCents: number };
export type BalanceExpenseRow = {
  grossCents: number;
  payerId: string;
  shares: { memberId: string; cents: number; pctSnapshot: number }[];
  aids: BalanceAid[];
  settlementStatus: SettlementStatus | null;
};

type ExpenseRow = Tables<"expense">;
type ExpenseShareRow = Tables<"expense_share">;
type AidRow = Tables<"aid">;
type SettlementRow = Tables<"settlement">;

function toShareDTO(row: ExpenseShareRow): ExpenseShareDTO {
  return {
    memberId: row.member_id,
    cents: row.share_cents,
    pctSnapshot: Number(row.share_pct_snapshot),
  };
}

function toStoredExpense(row: ExpenseRow, shares: ExpenseShareRow[]): StoredExpense {
  return {
    id: row.id,
    householdId: row.household_id,
    label: row.label,
    category: row.category,
    grossCents: row.gross_amount_cents,
    payerId: row.payer_member_id,
    incurredOn: row.incurred_on,
    source: row.source,
    settlementId: row.settlement_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    shares: shares.map(toShareDTO),
    deletedAt: row.deleted_at,
  };
}

function strip(e: StoredExpense): Expense {
  const { deletedAt: _deletedAt, ...rest } = e;
  return rest;
}

export class SupabaseExpenseRepository {
  constructor(private readonly supabase: DbClient) {}

  async getHouseholdMemberIds(householdId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from("membership")
      .select("member_id")
      .eq("household_id", householdId);
    if (error) throw error;
    return (data ?? []).map((m) => m.member_id);
  }

  async insertExpenseWithShares(
    expense: NewExpense,
    shares: ExpenseShareDTO[],
  ): Promise<Expense> {
    const { data: expenseId, error } = await this.supabase.rpc("create_expense_with_shares", {
      p_household_id: expense.householdId,
      p_label: expense.label,
      p_category: expense.category,
      p_gross_amount_cents: expense.grossCents,
      p_payer_member_id: expense.payerId,
      p_incurred_on: expense.incurredOn,
      p_source: expense.source,
      p_created_by: expense.createdBy,
      p_shares: shares.map((s) => ({
        member_id: s.memberId,
        cents: s.cents,
        pct_snapshot: s.pctSnapshot,
      })),
    });
    if (error) throw error;

    const created = await this.getExpenseById(expenseId);
    if (!created) throw new Error("Dépense introuvable juste après création.");
    return strip(created);
  }

  async getExpenseById(expenseId: string): Promise<StoredExpense | null> {
    const { data: expenseRow, error } = await this.supabase
      .from("expense")
      .select("*")
      .eq("id", expenseId)
      .maybeSingle();
    if (error) throw error;
    if (!expenseRow) return null;

    const { data: shareRows, error: sharesError } = await this.supabase
      .from("expense_share")
      .select("*")
      .eq("expense_id", expenseId);
    if (sharesError) throw sharesError;

    return toStoredExpense(expenseRow, shareRows ?? []);
  }

  async updateExpenseWithShares(
    expenseId: string,
    patch: ExpenseScalarPatch,
    shares: ExpenseShareDTO[],
  ): Promise<Expense> {
    const update: {
      label?: string;
      category?: Category;
      gross_amount_cents?: number;
      payer_member_id?: string;
      incurred_on?: string;
    } = {};
    if (patch.label !== undefined) update.label = patch.label;
    if (patch.category !== undefined) update.category = patch.category;
    if (patch.grossCents !== undefined) update.gross_amount_cents = patch.grossCents;
    if (patch.payerId !== undefined) update.payer_member_id = patch.payerId;
    if (patch.incurredOn !== undefined) update.incurred_on = patch.incurredOn;

    if (Object.keys(update).length > 0) {
      const { error } = await this.supabase.from("expense").update(update).eq("id", expenseId);
      if (error) throw error;
    }

    const { error: deleteError } = await this.supabase
      .from("expense_share")
      .delete()
      .eq("expense_id", expenseId);
    if (deleteError) throw deleteError;

    if (shares.length > 0) {
      const { error: insertError } = await this.supabase.from("expense_share").insert(
        shares.map((s) => ({
          expense_id: expenseId,
          member_id: s.memberId,
          share_cents: s.cents,
          share_pct_snapshot: s.pctSnapshot,
        })),
      );
      if (insertError) throw insertError;
    }

    const updated = await this.getExpenseById(expenseId);
    if (!updated) throw new Error("Dépense introuvable juste après mise à jour.");
    return strip(updated);
  }

  async softDeleteExpense(expenseId: string): Promise<{ id: string }> {
    const { error } = await this.supabase
      .from("expense")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", expenseId);
    if (error) throw error;
    return { id: expenseId };
  }

  async listExpenses(householdId: string, filters: ListExpensesFilters): Promise<Expense[]> {
    let query = this.supabase
      .from("expense")
      .select("*")
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .order("incurred_on", { ascending: false });

    if (filters.category) query = query.eq("category", filters.category);
    if (filters.month) {
      query = query.gte("incurred_on", `${filters.month}-01`).lt("incurred_on", nextMonth(filters.month));
    }

    const { data: expenseRows, error } = await query;
    if (error) throw error;
    if (!expenseRows || expenseRows.length === 0) return [];

    const ids = expenseRows.map((e) => e.id);
    const { data: shareRows, error: sharesError } = await this.supabase
      .from("expense_share")
      .select("*")
      .in("expense_id", ids);
    if (sharesError) throw sharesError;

    const sharesByExpense = new Map<string, ExpenseShareRow[]>();
    for (const row of shareRows ?? []) {
      const list = sharesByExpense.get(row.expense_id) ?? [];
      list.push(row);
      sharesByExpense.set(row.expense_id, list);
    }

    return expenseRows.map((row) =>
      strip(toStoredExpense(row, sharesByExpense.get(row.id) ?? [])),
    );
  }

  async listExpensesForBalance(householdId: string): Promise<BalanceExpenseRow[]> {
    const { data: expenseRows, error } = await this.supabase
      .from("expense")
      .select("*")
      .eq("household_id", householdId)
      .is("deleted_at", null);
    if (error) throw error;
    if (!expenseRows || expenseRows.length === 0) return [];

    const ids = expenseRows.map((e) => e.id);
    const [{ data: shareRows, error: sharesError }, { data: aidRows, error: aidsError }] =
      await Promise.all([
        this.supabase.from("expense_share").select("*").in("expense_id", ids),
        this.supabase.from("aid").select("*").in("expense_id", ids),
      ]);
    if (sharesError) throw sharesError;
    if (aidsError) throw aidsError;

    const settlementIds = [...new Set(expenseRows.map((e) => e.settlement_id).filter(Boolean))] as string[];
    const statusById = new Map<string, SettlementStatus>();
    if (settlementIds.length > 0) {
      const { data: settlementRows, error: settlementError } = await this.supabase
        .from("settlement")
        .select("id, status")
        .in("id", settlementIds);
      if (settlementError) throw settlementError;
      for (const s of (settlementRows ?? []) as Pick<SettlementRow, "id" | "status">[]) {
        statusById.set(s.id, s.status);
      }
    }

    const sharesByExpense = new Map<string, ExpenseShareRow[]>();
    for (const row of shareRows ?? []) {
      const list = sharesByExpense.get(row.expense_id) ?? [];
      list.push(row);
      sharesByExpense.set(row.expense_id, list);
    }
    const aidsByExpense = new Map<string, AidRow[]>();
    for (const row of aidRows ?? []) {
      const list = aidsByExpense.get(row.expense_id) ?? [];
      list.push(row);
      aidsByExpense.set(row.expense_id, list);
    }

    return expenseRows.map((row) => ({
      grossCents: row.gross_amount_cents,
      payerId: row.payer_member_id,
      shares: (sharesByExpense.get(row.id) ?? []).map(toShareDTO),
      aids: (aidsByExpense.get(row.id) ?? []).map((a) => ({
        beneficiaryId: a.beneficiary_member_id,
        amountCents: a.amount_cents,
      })),
      settlementStatus: row.settlement_id ? (statusById.get(row.settlement_id) ?? null) : null,
    }));
  }
}

/** `"2026-07"` → `"2026-08-01"` (borne exclusive pour le filtre mensuel). */
function nextMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m, 1));
  return date.toISOString().slice(0, 10);
}
