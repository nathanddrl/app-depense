// SupabaseSettlementRepository — implémentation concrète du port `SettlementRepository`
// défini par `@app/domain-settlement` (archi ch.1.4 / DA4, spec ch.5.3, T-C6.2).
//
// `db` reste une couche feuille (garde ESLint `no-restricted-imports` sur
// `@app/domain-*`) : ce fichier n'importe RIEN de `@app/domain-settlement`, pas
// même le type du port — deux vues (snake_case DB / camelCase domaine) du même
// schéma, comme `expense-repository.ts`/`aid-repository.ts`.
//
// `createSettlementAndFreezeExpenses` passe par la RPC `initiate_settlement`
// (insert settlement + gel des dépenses ouvertes du foyer) : atomicité native de
// la fonction, même précédent que `create_expense_with_shares`.

import type { DbClient } from "./client";
import type { Enums, Tables } from "./index";

export type SettlementStatus = Enums<"settlement_status">;

export type NewSettlement = {
  householdId: string;
  amountCents: number;
  fromMemberId: string;
  toMemberId: string;
  initiatedBy: string;
};

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

type SettlementRow = Tables<"settlement">;

function toSettlement(row: SettlementRow): Settlement {
  return {
    id: row.id,
    householdId: row.household_id,
    status: row.status,
    amountCents: row.amount_cents,
    fromMemberId: row.from_member_id,
    toMemberId: row.to_member_id,
    initiatedBy: row.initiated_by,
    initiatedAt: row.initiated_at,
    confirmedBy: row.confirmed_by,
    confirmedAt: row.confirmed_at,
    cancelledAt: row.cancelled_at,
  };
}

export class SupabaseSettlementRepository {
  constructor(private readonly supabase: DbClient) {}

  async getPendingSettlement(householdId: string): Promise<{ id: string } | null> {
    const { data, error } = await this.supabase
      .from("settlement")
      .select("id")
      .eq("household_id", householdId)
      .eq("status", "pending")
      .maybeSingle();
    if (error) throw error;
    return data ? { id: data.id } : null;
  }

  async createSettlementAndFreezeExpenses(newSettlement: NewSettlement): Promise<Settlement> {
    const { data: settlementId, error } = await this.supabase.rpc("initiate_settlement", {
      p_household_id: newSettlement.householdId,
      p_amount_cents: newSettlement.amountCents,
      p_from_member_id: newSettlement.fromMemberId,
      p_to_member_id: newSettlement.toMemberId,
      p_initiated_by: newSettlement.initiatedBy,
    });
    if (error) throw error;

    const { data: row, error: fetchError } = await this.supabase
      .from("settlement")
      .select("*")
      .eq("id", settlementId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!row) throw new Error("Settlement introuvable juste après création.");
    return toSettlement(row);
  }
}
