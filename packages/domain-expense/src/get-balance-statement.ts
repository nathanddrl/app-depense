// @app/domain-expense — relevé de l'écart (écran « d'où vient l'écart ») :
// dépenses, aides, versements et corrections qui, additionnés, donnent le
// solde affiché au centre du donut. Le domaine choisit la période (même
// borne que le donut, `findPeriodStart`) et charge les données ; tout le
// calcul sort de calc-engine (`computeBalanceStatement`, DA4).

import { computeBalanceStatement, computeExpense } from "@app/calc-engine";
import type { StatementExpense } from "@app/calc-engine";
import { err, ok, getTodayParis } from "@app/shared";
import type { ActionResult } from "@app/shared";
import type { ExpenseRepository } from "./repository";
import type {
  BalanceStatementView,
  ConfirmedSettlementForPeriod,
  ExpenseContext,
  PeriodStart,
  SettlementCorrectionLine,
} from "./types";

export async function getBalanceStatement(
  repo: ExpenseRepository,
  ctx: ExpenseContext,
  {
    householdId,
    periodStart,
    settlements,
    corrections,
    today = getTodayParis(),
  }: {
    householdId: string;
    periodStart: PeriodStart | null;
    settlements: ConfirmedSettlementForPeriod[];
    corrections: SettlementCorrectionLine[];
    today?: string;
  },
): Promise<ActionResult<BalanceStatementView>> {
  if (householdId !== ctx.householdId) {
    return err("FORBIDDEN", "Foyer non autorisé.");
  }

  const expenses = await repo.listExpenses(householdId, {});

  // Même fenêtre que le donut (`getBalanceBreakdown`) : déjà engagées, et
  // postérieures au jour du règlement qui a remis l'écart à zéro (exclusif).
  const periodRows = expenses.filter(
    (row) => row.incurredOn <= today && (!periodStart || row.incurredOn > periodStart.date),
  );

  // Versements confirmés APRÈS ce règlement (instant exact, pas le jour : deux
  // règlements le même jour restent distingués). Sans période, tous.
  const periodSettlements = settlements
    .filter((s) => !periodStart || Date.parse(s.confirmedAt) > Date.parse(periodStart.settledAt))
    .sort((a, b) => Date.parse(a.confirmedAt) - Date.parse(b.confirmedAt));

  const statementExpenses: StatementExpense[] = periodRows.map((row) => {
    const ratio = row.shares.map((s) => ({ memberId: s.memberId, pct: s.pctSnapshot }));
    // Aides effectives (post-plafond 4.4), parts figées — comme `getBalance`.
    const { effectiveAids } = computeExpense({
      grossCents: row.grossCents,
      payerId: row.payerId,
      ratio,
      aids: row.aids,
    });
    return {
      grossCents: row.grossCents,
      payerId: row.payerId,
      ratio,
      shares: row.shares.map((s) => ({ memberId: s.memberId, cents: s.cents })),
      effectiveAids,
    };
  });

  const lines = computeBalanceStatement({
    memberId: ctx.memberId,
    expenses: statementExpenses,
    settlements: periodSettlements.map((s) => ({
      fromMemberId: s.fromMemberId,
      toMemberId: s.toMemberId,
      amountCents: s.amountCents,
      status: "confirmed",
    })),
    corrections: corrections.map((c) => c.balanceDelta),
  });

  // % de part du membre, affiché seulement s'il est le même partout.
  const pcts = new Set(
    periodRows.map((row) => row.shares.find((s) => s.memberId === ctx.memberId)?.pctSnapshot ?? 0),
  );
  const sharePct = pcts.size === 1 ? [...pcts][0] : null;

  return ok({
    memberId: ctx.memberId,
    lines,
    sharePct,
    aids: periodRows
      .flatMap((row) =>
        row.aids.map((aid) => ({
          id: aid.id,
          label: aid.label,
          expenseLabel: row.label,
          incurredOn: row.incurredOn,
          beneficiaryId: aid.beneficiaryId,
          amountCents: aid.amountCents,
        })),
      )
      .sort((a, b) => a.incurredOn.localeCompare(b.incurredOn) || a.label.localeCompare(b.label)),
    settlements: periodSettlements,
  });
}
