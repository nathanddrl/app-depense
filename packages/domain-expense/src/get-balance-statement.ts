// @app/domain-expense — relevé de l'écart (écran « d'où vient l'écart ») :
// dépenses, aides, versements et corrections qui, additionnés, donnent le
// solde affiché au centre du donut. Le domaine choisit la période (même
// borne que le donut, `findPeriodStart`) et charge les données ; tout le
// calcul sort de calc-engine (`computeBalanceStatement`, DA4).
//
// Une seule lecture de l'historique (`listAllExpensesForAdmin`) sert au relevé
// ET aux corrections postérieures au règlement (`computeSettlementCorrections`).

import { computeBalanceDelta, computeBalanceStatement, computeExpense } from "@app/calc-engine";
import type { BalanceExpense, StatementExpense } from "@app/calc-engine";
import { err, ok, getTodayParis } from "@app/shared";
import type { ActionResult } from "@app/shared";
import { computeSettlementCorrections } from "./get-settlement-corrections";
import { signedBalanceFor, toBalanceExpense } from "./internal";
import type { ExpenseRepository, StoredExpense } from "./repository";
import type {
  Balance,
  BalanceExplanation,
  ConfirmedSettlementForPeriod,
  ExpenseContext,
  PeriodStart,
} from "./types";

/** Vue solde d'une dépense avec ses parts FIGÉES (comme `getBalance`). */
function frozenBalanceExpense(row: StoredExpense): BalanceExpense {
  const { effectiveAids } = computeExpense({
    grossCents: row.grossCents,
    payerId: row.payerId,
    ratio: row.shares.map((s) => ({ memberId: s.memberId, pct: s.pctSnapshot })),
    aids: row.aids,
  });
  return {
    grossCents: row.grossCents,
    payerId: row.payerId,
    shares: row.shares.map((s) => ({ memberId: s.memberId, cents: s.cents })),
    effectiveAids,
  };
}

export async function getBalanceStatement(
  repo: ExpenseRepository,
  ctx: ExpenseContext,
  {
    householdId,
    periodStart,
    settlements,
    balance,
    today = getTodayParis(),
  }: {
    householdId: string;
    periodStart: PeriodStart | null;
    settlements: ConfirmedSettlementForPeriod[];
    /** Solde affiché (`getBalance`) : le relevé doit retomber dessus au centime. */
    balance: Balance;
    today?: string;
  },
): Promise<ActionResult<BalanceExplanation>> {
  if (householdId !== ctx.householdId) {
    return err("FORBIDDEN", "Foyer non autorisé.");
  }

  const [memberIds, all] = await Promise.all([
    repo.getHouseholdMemberIds(householdId),
    repo.listAllExpensesForAdmin(householdId),
  ]);

  const corrections = periodStart
    ? computeSettlementCorrections(all, memberIds, periodStart, today)
    : [];

  // Dépenses actives déjà engagées (4.2), comme `getBalance`.
  const active = all.filter((e) => e.deletedAt === null && e.incurredOn <= today);
  // Même fenêtre que le donut (`getBalanceBreakdown`), borne exclusive.
  const periodRows = active.filter((e) => !periodStart || e.incurredOn > periodStart.date);

  // La remise à zéro (`findPeriodStart`) et les corrections rejouent les
  // dépenses d'avant la période avec des parts RECALCULÉES ; le solde affiché
  // les compte avec leurs parts FIGÉES. L'écart d'arrondi éventuel entre les
  // deux rejoint la ligne « corrections » : sans lui, le relevé ne
  // retomberait pas exactement sur le solde.
  const roundingDeltas = periodStart
    ? active
        .filter((e) => e.incurredOn <= periodStart.date)
        .map((e) => computeBalanceDelta(toBalanceExpense(e), frozenBalanceExpense(e), memberIds))
    : [];

  // Versements confirmés APRÈS ce règlement (instant exact, pas le jour : deux
  // règlements le même jour restent distingués). Sans période, tous.
  const periodSettlements = settlements
    .filter((s) => !periodStart || Date.parse(s.confirmedAt) > Date.parse(periodStart.settledAt))
    .sort((a, b) => Date.parse(a.confirmedAt) - Date.parse(b.confirmedAt));

  const statementExpenses: StatementExpense[] = periodRows.map((row) => ({
    ...frozenBalanceExpense(row),
    ratio: row.shares.map((s) => ({ memberId: s.memberId, pct: s.pctSnapshot })),
  }));

  const lines = computeBalanceStatement({
    memberId: ctx.memberId,
    expenses: statementExpenses,
    settlements: periodSettlements.map((s) => ({
      fromMemberId: s.fromMemberId,
      toMemberId: s.toMemberId,
      amountCents: s.amountCents,
      status: "confirmed",
    })),
    corrections: [...corrections.map((c) => c.balanceDelta), ...roundingDeltas],
  });

  // Garde-fou : jamais un relevé qui ne retombe pas sur le solde affiché.
  const expectedTotal = signedBalanceFor(balance, ctx.memberId);
  if (lines.totalCents !== expectedTotal) {
    console.error("[relevé] total incohérent avec le solde", {
      householdId,
      statementTotal: lines.totalCents,
      expectedTotal,
    });
    return ok({ statement: null, corrections });
  }

  // % de part du membre, affiché seulement s'il est le même partout.
  const pcts = new Set(
    periodRows.map((row) => row.shares.find((s) => s.memberId === ctx.memberId)?.pctSnapshot ?? 0),
  );
  const sharePct = pcts.size === 1 ? [...pcts][0] : null;

  // Aides EFFECTIVES (post-plafond 4.4) par dépense et bénéficiaire : mêmes
  // montants que la ligne « aides » ; le montant déclaré n'est gardé que s'il
  // diffère (aide plafonnée).
  const aids = periodRows
    .flatMap((row) =>
      frozenBalanceExpense(row)
        .effectiveAids.filter((effective) => effective.effectiveCents > 0)
        .map((effective) => {
          const own = row.aids.filter((a) => a.beneficiaryId === effective.beneficiaryId);
          const declaredCents = own.reduce((sum, a) => sum + a.amountCents, 0);
          return {
            id: `${row.id}-${effective.beneficiaryId}`,
            label: own.map((a) => a.label).join(", "),
            expenseLabel: row.label,
            incurredOn: row.incurredOn,
            beneficiaryId: effective.beneficiaryId,
            amountCents: effective.effectiveCents,
            ...(declaredCents !== effective.effectiveCents ? { declaredCents } : {}),
          };
        }),
    )
    .sort((a, b) => a.incurredOn.localeCompare(b.incurredOn) || a.label.localeCompare(b.label));

  return ok({
    statement: { memberId: ctx.memberId, lines, sharePct, aids, settlements: periodSettlements },
    corrections,
  });
}
