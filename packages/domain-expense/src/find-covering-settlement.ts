// @app/domain-expense — une dépense est-elle déjà couverte par le dernier
// règlement confirmé ? Sert à AVERTIR (jamais bloquer, choix produit) avant de
// la modifier ou de la supprimer : la corriger fera bouger l'écart, et la
// correction apparaîtra à part dans « d'où vient l'écart »
// (`getSettlementCorrections`).
//
// Couverte = connue au moment du règlement (créée avant, pas encore
// supprimée) ET datée au plus tard le jour du règlement (date de Paris, D4).
// Seul le dernier règlement compte : une dépense couverte par un règlement
// plus ancien l'est forcément aussi par les suivants.

import { err, ok, toDateParis } from "@app/shared";
import type { ActionResult } from "@app/shared";
import { expenseKnownAt } from "./internal";
import type { ExpenseRepository } from "./repository";
import type { ConfirmedSettlementForPeriod, ExpenseContext, PeriodStart } from "./types";

export async function findCoveringSettlement(
  repo: ExpenseRepository,
  ctx: ExpenseContext,
  { expenseId, settlements }: { expenseId: string; settlements: ConfirmedSettlementForPeriod[] },
): Promise<ActionResult<PeriodStart | null>> {
  const expense = await repo.getExpenseById(expenseId);
  if (!expense || expense.householdId !== ctx.householdId) {
    return err("NOT_FOUND", "Dépense introuvable.");
  }

  const last = settlements.reduce<ConfirmedSettlementForPeriod | null>(
    (latest, s) =>
      !latest || Date.parse(s.confirmedAt) > Date.parse(latest.confirmedAt) ? s : latest,
    null,
  );
  if (!last) return ok(null);

  const date = toDateParis(last.confirmedAt);
  const known = expenseKnownAt(expense, last.confirmedAt);
  if (!known || known.incurredOn > date) return ok(null);
  return ok({ date, settledAt: last.confirmedAt });
}
