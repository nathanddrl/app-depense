// @app/domain-expense — mois distincts ayant au moins une dépense active, pour
// peupler les options du filtre mois de /mouvements (T-CN3.2). Le scope foyer
// vient du seam (jamais du client), comme `listExpenses`.

import { ok } from "@app/shared";
import type { ActionResult } from "@app/shared";
import type { ExpenseRepository } from "./repository";
import type { ExpenseContext } from "./types";

export async function listExpenseMonths(
  repo: ExpenseRepository,
  ctx: ExpenseContext,
): Promise<ActionResult<string[]>> {
  const months = await repo.listExpenseMonths(ctx.householdId);
  return ok(months);
}
