// @app/domain-expense — détail dépliable de transparence (spec 8.3, T-C4.4).
// Décomposition « en deux temps » PAR dépense contributive au solde, en données
// brutes : construire la phrase humaine (prénoms, « tu »/« toi ») est un souci
// d'affichage (8.1), pas de calcul — il vit dans la couche web.

import { computeExpenseBreakdown } from "@app/calc-engine";
import type { LabelledAidInput } from "@app/calc-engine";
import { err, ok, getTodayParis } from "@app/shared";
import type { ActionResult } from "@app/shared";
import type { ExpenseRepository } from "./repository";
import type { BalanceDetailLine, ExpenseContext, ExpenseSource } from "./types";

function toExpenseSource(source: string): ExpenseSource {
  if (source === "manual" || source === "recurring") return source;
  throw new Error(`Source de dépense inconnue: ${source}`);
}

export async function getBalanceDetail(
  repo: ExpenseRepository,
  ctx: ExpenseContext,
  { householdId, today = getTodayParis() }: { householdId: string; today?: string },
): Promise<ActionResult<BalanceDetailLine[]>> {
  if (householdId !== ctx.householdId) {
    return err("FORBIDDEN", "Foyer non autorisé.");
  }

  const rows = await repo.listExpensesForBalance(householdId);

  // Même exclusion des dépenses futures que `getBalance` (4.2) : le détail
  // dépliable ne doit pas montrer une contribution qui n'existe pas encore
  // dans le solde affiché.
  const activeRows = rows.filter((row) => row.incurredOn <= today);

  const lines: BalanceDetailLine[] = activeRows.map((row) => {
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
      source: toExpenseSource(row.source),
    };
  });

  return ok(lines);
}
