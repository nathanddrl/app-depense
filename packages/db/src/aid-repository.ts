// SupabaseAidRepository — implémentation concrète du port `AidRepository`
// défini par `@app/domain-aid` (archi ch.1.4 / DA4, spec ch.5.2).
//
// `db` reste une couche feuille (garde ESLint `no-restricted-imports` sur
// `@app/domain-*`) : ce fichier n'importe RIEN de `@app/domain-aid`, pas même le
// type du port. Les types ci-dessous ont les mêmes noms de champs que le port
// (voir `packages/domain-aid/src/repository.ts`) mais sont dérivés ici de la
// connaissance que `db` a déjà de son propre schéma — deux vues (snake_case DB /
// camelCase domaine) du même schéma, comme `expense-repository.ts`.
//
// Même précédent que `updateExpenseWithShares` (pas de RPC atomique) : insert/
// delete de la ligne `aid` puis delete+insert des `expense_share`, en 2-3 appels.

import type { DbClient } from "./client";
import type { Tables } from "./index";

export type ExpenseShareDTO = { memberId: string; cents: number; pctSnapshot: number };
export type AidDTO = { id: string; beneficiaryId: string; label: string; amountCents: number };

export type NewAid = {
  expenseId: string;
  beneficiaryId: string;
  label: string;
  amountCents: number;
};

export type ExpenseForAid = {
  id: string;
  householdId: string;
  grossCents: number;
  payerId: string;
  settlementId: string | null;
  ratio: { memberId: string; pct: number }[];
  aids: AidDTO[];
};

export type Expense = {
  id: string;
  householdId: string;
  grossCents: number;
  payerId: string;
  settlementId: string | null;
  shares: ExpenseShareDTO[];
  aids: AidDTO[];
};

type ExpenseRow = Tables<"expense">;
type ExpenseShareRow = Tables<"expense_share">;
type AidRow = Tables<"aid">;

function toAidDTO(row: AidRow): AidDTO {
  return {
    id: row.id,
    beneficiaryId: row.beneficiary_member_id,
    label: row.label,
    amountCents: row.amount_cents,
  };
}

function toShareDTO(row: ExpenseShareRow): ExpenseShareDTO {
  return {
    memberId: row.member_id,
    cents: row.share_cents,
    pctSnapshot: Number(row.share_pct_snapshot),
  };
}

export class SupabaseAidRepository {
  constructor(private readonly supabase: DbClient) {}

  async getHouseholdMemberIds(householdId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from("membership")
      .select("member_id")
      .eq("household_id", householdId);
    if (error) throw error;
    return (data ?? []).map((m) => m.member_id);
  }

  async getExpenseForAid(expenseId: string): Promise<ExpenseForAid | null> {
    const { data: expenseRow, error } = await this.supabase
      .from("expense")
      .select("*")
      .eq("id", expenseId)
      .maybeSingle();
    if (error) throw error;
    if (!expenseRow) return null;

    const [{ data: shareRows, error: sharesError }, { data: aidRows, error: aidsError }] =
      await Promise.all([
        this.supabase.from("expense_share").select("*").eq("expense_id", expenseId),
        this.supabase.from("aid").select("*").eq("expense_id", expenseId),
      ]);
    if (sharesError) throw sharesError;
    if (aidsError) throw aidsError;

    return this.toExpenseForAid(expenseRow, shareRows ?? [], aidRows ?? []);
  }

  async getAidById(aidId: string): Promise<{ id: string; expenseId: string } | null> {
    const { data, error } = await this.supabase
      .from("aid")
      .select("id, expense_id")
      .eq("id", aidId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { id: data.id, expenseId: data.expense_id };
  }

  async addAid(newAid: NewAid, shares: ExpenseShareDTO[]): Promise<Expense> {
    const { error: insertError } = await this.supabase.from("aid").insert({
      expense_id: newAid.expenseId,
      beneficiary_member_id: newAid.beneficiaryId,
      label: newAid.label,
      amount_cents: newAid.amountCents,
    });
    if (insertError) throw insertError;

    await this.replaceShares(newAid.expenseId, shares);
    return this.getExpenseOrThrow(newAid.expenseId);
  }

  async removeAid(aidId: string, shares: ExpenseShareDTO[]): Promise<Expense> {
    const { data: aidRow, error: fetchError } = await this.supabase
      .from("aid")
      .select("expense_id")
      .eq("id", aidId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!aidRow) throw new Error("Aide introuvable juste avant suppression.");

    const { error: deleteError } = await this.supabase.from("aid").delete().eq("id", aidId);
    if (deleteError) throw deleteError;

    await this.replaceShares(aidRow.expense_id, shares);
    return this.getExpenseOrThrow(aidRow.expense_id);
  }

  private async replaceShares(expenseId: string, shares: ExpenseShareDTO[]): Promise<void> {
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
  }

  private async getExpenseOrThrow(expenseId: string): Promise<Expense> {
    const { data: expenseRow, error } = await this.supabase
      .from("expense")
      .select("*")
      .eq("id", expenseId)
      .maybeSingle();
    if (error) throw error;
    if (!expenseRow) throw new Error("Dépense introuvable juste après mise à jour des aides.");

    const [{ data: shareRows, error: sharesError }, { data: aidRows, error: aidsError }] =
      await Promise.all([
        this.supabase.from("expense_share").select("*").eq("expense_id", expenseId),
        this.supabase.from("aid").select("*").eq("expense_id", expenseId),
      ]);
    if (sharesError) throw sharesError;
    if (aidsError) throw aidsError;

    return {
      id: expenseRow.id,
      householdId: expenseRow.household_id,
      grossCents: expenseRow.gross_amount_cents,
      payerId: expenseRow.payer_member_id,
      settlementId: expenseRow.settlement_id,
      shares: (shareRows ?? []).map(toShareDTO),
      aids: (aidRows ?? []).map(toAidDTO),
    };
  }

  private toExpenseForAid(
    row: ExpenseRow,
    shareRows: ExpenseShareRow[],
    aidRows: AidRow[],
  ): ExpenseForAid {
    return {
      id: row.id,
      householdId: row.household_id,
      grossCents: row.gross_amount_cents,
      payerId: row.payer_member_id,
      settlementId: row.settlement_id,
      ratio: shareRows.map((s) => ({ memberId: s.member_id, pct: Number(s.share_pct_snapshot) })),
      aids: aidRows.map(toAidDTO),
    };
  }
}
