// @app/domain-expense — suppression d'une dépense (spec ch.5.1). Soft delete (D2) :
// on pose `deleted_at`, jamais de suppression physique (la donnée survit pour la
// trajectoire co-pilote An 2, invariant 3).

import { err, ok } from "@app/shared";
import type { ActionResult } from "@app/shared";
import type { ExpenseRepository } from "./repository";
import type { ExpenseContext } from "./types";

export async function deleteExpense(
  repo: ExpenseRepository,
  ctx: ExpenseContext,
  input: { expenseId: string },
): Promise<ActionResult<{ id: string }>> {
  const existing = await repo.getExpenseById(input.expenseId);
  if (!existing || existing.deletedAt !== null || existing.householdId !== ctx.householdId) {
    return err("NOT_FOUND", "Dépense introuvable.");
  }

  // Verrou de régularisation (ch.7 / D7, T-C6.4) : `pending` ou `confirmed`
  // verrouillent identiquement, seul `settlement_id IS NOT NULL` compte.
  if (existing.settlementId !== null) {
    return err(
      "EXPENSE_LOCKED",
      "Cette dépense est rattachée à une régularisation et n'est plus modifiable.",
    );
  }

  const result = await repo.softDeleteExpense(input.expenseId);
  return ok(result);
}
