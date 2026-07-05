// @app/domain-expense — détail dépliable de transparence (spec 8.3, T-C4.4).
// Décomposition « en deux temps » PAR dépense contributive au solde, en données
// brutes : construire la phrase humaine (prénoms, « tu »/« toi ») est un souci
// d'affichage (8.1), pas de calcul — il vit dans la couche web.

import { computeExpenseBreakdown } from "@app/calc-engine";
import type { LabelledAidInput } from "@app/calc-engine";
import { err, ok } from "@app/shared";
import type { ActionResult } from "@app/shared";
import type { ExpenseRepository } from "./repository";
import type { BalanceDetailLine, ExpenseContext } from "./types";

/** Même filtre que `getBalance` (4.2) : non supprimée, settlement pas confirmé. */
function countsInBalance(settlementStatus: string | null): boolean {
  return settlementStatus !== "confirmed";
}

export async function getBalanceDetail(
  repo: ExpenseRepository,
  ctx: ExpenseContext,
  { householdId }: { householdId: string },
): Promise<ActionResult<BalanceDetailLine[]>> {
  if (householdId !== ctx.householdId) {
    return err("FORBIDDEN", "Foyer non autorisé.");
  }

  const rows = await repo.listExpensesForBalance(householdId);

  const lines: BalanceDetailLine[] = rows
    .filter((r) => countsInBalance(r.settlementStatus))
    .map((row) => {
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
        label: row.label,
        grossCents: row.grossCents,
        payerId: breakdown.payerId,
        otherId: breakdown.otherId,
        baseOwedCents: breakdown.baseOwedCents,
        aidLines: breakdown.aidLines,
        totalOwedCents: breakdown.totalOwedCents,
      };
    });

  return ok(lines);
}
