// @app/domain-expense — historique chronologique (spec ch.5.1, 6.2 `listExpenses`).
// Filtrable par mois et catégorie ; soft-deleted exclues ; ordre décroissant. Le
// scope foyer vient du seam (jamais du client).

import { ok } from "@app/shared";
import type { ActionResult } from "@app/shared";
import type { ExpenseRepository } from "./repository";
import type { Expense, ExpenseContext, ListExpensesFilters } from "./types";

export async function listExpenses(
  repo: ExpenseRepository,
  ctx: ExpenseContext,
  filters: ListExpensesFilters = {},
): Promise<ActionResult<Expense[]>> {
  const expenses = await repo.listExpenses(ctx.householdId, filters);
  return ok(expenses);
}
