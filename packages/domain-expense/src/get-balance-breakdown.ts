// @app/domain-expense — décomposition « ce qui a été payé » pour l'écran
// donut (refonte solde, remplace l'ancien détail dépliable). Le domaine
// charge les dépenses actives via le port et délègue le regroupement à
// calc-engine (DA4) : aucune agrégation ici, seulement le filtrage temporel
// et le mapping vers les DTOs du domaine.

import { computePaidBreakdown } from "@app/calc-engine";
import type { PaidExpenseInput } from "@app/calc-engine";
import { err, ok, getTodayParis } from "@app/shared";
import type { ActionResult } from "@app/shared";
import type { ExpenseRepository } from "./repository";
import type { Category, ExpenseContext, MemberPaidBreakdown } from "./types";

export async function getBalanceBreakdown(
  repo: ExpenseRepository,
  ctx: ExpenseContext,
  {
    householdId,
    periodStart,
    today = getTodayParis(),
  }: { householdId: string; periodStart?: string; today?: string },
): Promise<ActionResult<MemberPaidBreakdown[]>> {
  if (householdId !== ctx.householdId) {
    return err("FORBIDDEN", "Foyer non autorisé.");
  }

  const [memberIds, expenses] = await Promise.all([
    repo.getHouseholdMemberIds(householdId),
    repo.listExpenses(householdId, {}),
  ]);

  // Même exclusion des dépenses futures que `getBalance`/`getBalanceDetail`
  // (4.2), plus la borne basse de période (depuis la dernière régularisation
  // confirmée, composée par l'appelant — domain-expense n'importe jamais
  // domain-settlement, DA4). `periodStart` exclusif : une dépense datée le
  // jour même de la confirmation est considérée déjà couverte par elle.
  const periodRows = expenses.filter(
    (row) => row.incurredOn <= today && (!periodStart || row.incurredOn > periodStart),
  );

  const inputs: PaidExpenseInput[] = periodRows.map((row) => ({
    id: row.id,
    label: row.label,
    category: row.category,
    grossCents: row.grossCents,
    payerId: row.payerId,
  }));

  const breakdown = computePaidBreakdown(inputs, memberIds);

  // Mapping 1:1 vers les DTOs du domaine — `category` provient de dépenses
  // réelles (déjà typées `Category` en amont), le cast est sûr.
  return ok(
    breakdown.map((member) => ({
      memberId: member.memberId,
      totalCents: member.totalCents,
      categories: member.categories.map((c) => ({
        category: c.category as Category,
        totalCents: c.totalCents,
        expenses: c.expenses,
      })),
    })),
  );
}
