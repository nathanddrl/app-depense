// Historisation d'une dépense AVANT toute réécriture (scalaires/parts, ajout
// ou retrait d'aide) — cf. migration `20261021120000_expense_revision.sql`.
// Partagé par `SupabaseExpenseRepository` et `SupabaseAidRepository` : ces
// réécritures se font en plusieurs requêtes, l'état figé ici est le seul
// moyen de rejouer plus tard la dépense telle qu'elle était à une date donnée.

import type { DbClient } from "./client";
import type { Tables } from "./index";

/** État d'une dépense jusqu'à `replacedAt` (lecture camelCase de `expense_revision`). */
export type ExpenseRevisionDTO = {
  replacedAt: string;
  label: string;
  category: Tables<"expense">["category"];
  grossCents: number;
  payerId: string;
  incurredOn: string;
  shares: { memberId: string; cents: number; pctSnapshot: number }[];
  aids: {
    id: string;
    beneficiaryId: string;
    label: string;
    amountCents: number;
    createdAt: string;
  }[];
};

type RevisionShareJson = { member_id: string; share_cents: number; share_pct_snapshot: number };
type RevisionAidJson = {
  id: string;
  beneficiary_member_id: string;
  label: string;
  amount_cents: number;
  created_at: string;
};

export async function snapshotExpense(supabase: DbClient, expenseId: string): Promise<void> {
  const { error } = await supabase.rpc("snapshot_expense", { p_expense_id: expenseId });
  if (error) throw error;
}

export function toRevisionDTO(row: Tables<"expense_revision">): ExpenseRevisionDTO {
  return {
    replacedAt: row.replaced_at,
    label: row.label,
    category: row.category,
    grossCents: row.gross_amount_cents,
    payerId: row.payer_member_id,
    incurredOn: row.incurred_on,
    shares: (row.shares as RevisionShareJson[]).map((s) => ({
      memberId: s.member_id,
      cents: s.share_cents,
      pctSnapshot: Number(s.share_pct_snapshot),
    })),
    aids: (row.aids as RevisionAidJson[]).map((a) => ({
      id: a.id,
      beneficiaryId: a.beneficiary_member_id,
      label: a.label,
      amountCents: a.amount_cents,
      createdAt: a.created_at,
    })),
  };
}
