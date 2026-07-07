// @app/domain-expense — vue admin brute des dépenses du foyer (T-C8.2, DA14).
// Aucun filtre `deleted_at`/`settlement` : contrairement à `getBalanceDetail`
// (8.3), on décompose TOUTE dépense, y compris verrouillée ou supprimée. Même
// décomposition calc-engine que `getBalanceDetail` (DA4 : pas de second calcul).

import { computeExpenseBreakdown } from "@app/calc-engine";
import type { LabelledAidInput } from "@app/calc-engine";
import { err, ok } from "@app/shared";
import type { ActionResult } from "@app/shared";
import type { ExpenseRepository } from "./repository";
import type { AdminExpenseOverviewLine, ExpenseContext } from "./types";

export async function getAdminExpenseOverview(
  repo: ExpenseRepository,
  ctx: ExpenseContext,
  { householdId }: { householdId: string },
): Promise<ActionResult<AdminExpenseOverviewLine[]>> {
  // Revérification serveur (T-C8.1) : le layout `/admin` ne suffit pas.
  if (ctx.role !== "admin") {
    return err("FORBIDDEN", "Réservé aux administrateurs.");
  }
  if (householdId !== ctx.householdId) {
    return err("FORBIDDEN", "Foyer non autorisé.");
  }

  const rows = await repo.listAllExpensesForAdmin(householdId);

  const lines: AdminExpenseOverviewLine[] = rows.map((row) => {
    const aids: LabelledAidInput[] = row.aids.map((a) => ({
      beneficiaryId: a.beneficiaryId,
      amountCents: a.amountCents,
      label: a.label,
    }));
    const breakdown = computeExpenseBreakdown({
      grossCents: row.grossCents,
      payerId: row.payerId,
      ratio: row.shares.map((s) => ({ memberId: s.memberId, pct: s.pctSnapshot })),
      aids,
    });
    return {
      id: row.id,
      label: row.label,
      category: row.category,
      incurredOn: row.incurredOn,
      grossCents: row.grossCents,
      payerId: breakdown.payerId,
      otherId: breakdown.otherId,
      settlementId: row.settlementId,
      deletedAt: row.deletedAt,
      baseOwedCents: breakdown.baseOwedCents,
      aidLines: breakdown.aidLines,
      totalOwedCents: breakdown.totalOwedCents,
    };
  });

  return ok(lines);
}
