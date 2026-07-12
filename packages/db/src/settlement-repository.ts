// SupabaseSettlementRepository — implémentation concrète du port `SettlementRepository`
// défini par `@app/domain-settlement` (archi ch.1.4 / DA4, spec ch.5.3, T-C6.2,
// D7/D15 révisés — modèle ledger).
//
// `db` reste une couche feuille (garde ESLint `no-restricted-imports` sur
// `@app/domain-*`) : ce fichier n'importe RIEN de `@app/domain-settlement`, pas
// même le type du port — deux vues (snake_case DB / camelCase domaine) du même
// schéma, comme `expense-repository.ts`/`aid-repository.ts`.
//
// `createSettlement`/`cancelSettlement`/`confirmSettlement` ne touchent tous
// que la table `settlement` (plus de gel/dé-gel des dépenses, D7 révisé) : de
// simples `.insert()`/`.update()` sont nativement atomiques, plus besoin des
// RPC `initiate_settlement`/`cancel_settlement` (supprimées, cf. migration
// `20260712140000_partial_settlement.sql`).

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

  async createSettlement(newSettlement: NewSettlement): Promise<Settlement> {
    const { data: row, error } = await this.supabase
      .from("settlement")
      .insert({
        household_id: newSettlement.householdId,
        amount_cents: newSettlement.amountCents,
        from_member_id: newSettlement.fromMemberId,
        to_member_id: newSettlement.toMemberId,
        initiated_by: newSettlement.initiatedBy,
      })
      .select()
      .single();
    if (error) throw error;
    return toSettlement(row);
  }

  async getSettlementById(settlementId: string): Promise<Settlement | null> {
    const { data, error } = await this.supabase
      .from("settlement")
      .select("*")
      .eq("id", settlementId)
      .maybeSingle();
    if (error) throw error;
    return data ? toSettlement(data) : null;
  }

  async confirmSettlement(settlementId: string, confirmedBy: string): Promise<Settlement> {
    const { data, error } = await this.supabase
      .from("settlement")
      .update({
        status: "confirmed",
        confirmed_by: confirmedBy,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", settlementId)
      .eq("status", "pending")
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Settlement introuvable ou déjà traité.");
    return toSettlement(data);
  }

  async cancelSettlement(settlementId: string): Promise<Settlement> {
    const { data, error } = await this.supabase
      .from("settlement")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", settlementId)
      .eq("status", "pending")
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Settlement introuvable ou déjà traité.");
    return toSettlement(data);
  }

  async listConfirmedSettlements(householdId: string): Promise<Settlement[]> {
    const { data, error } = await this.supabase
      .from("settlement")
      .select("*")
      .eq("household_id", householdId)
      .eq("status", "confirmed");
    if (error) throw error;
    return (data ?? []).map(toSettlement);
  }
}
