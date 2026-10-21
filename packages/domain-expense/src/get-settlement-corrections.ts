// @app/domain-expense — corrections faites APRÈS la dernière régularisation
// sur des dépenses qu'elle couvrait déjà (écran « d'où vient l'écart »).
//
// Le donut ne montre que les dépenses postérieures à la régularisation
// (`findPeriodStart`). Mais le solde au centre est cumulé depuis toujours
// (modèle ledger) : toute correction ultérieure d'une dépense datée au plus
// tard le jour de la régularisation (doublon supprimé, aide ajoutée,
// occurrence récurrente générée en retard) le fait bouger sans apparaître
// dans le donut. Ces lignes rendent cet écart visible et explicable.
//
// Comparaison « connu à la régularisation » (`expenseKnownAt`, historique
// `expense_revision` compris : montant, parts, aides retirées) vs « actuel »,
// dépense par dépense ; l'effet sur le solde sort de calc-engine
// (`computeBalanceDelta`), jamais d'une arithmétique locale (DA4).

import { computeBalanceDelta } from "@app/calc-engine";
import { err, ok, getTodayParis } from "@app/shared";
import type { ActionResult } from "@app/shared";
import { expenseKnownAt, toBalanceExpense } from "./internal";
import type { ExpenseRepository, StoredExpense } from "./repository";
import type {
  ExpenseContext,
  PeriodStart,
  SettlementCorrectionKind,
  SettlementCorrectionLine,
} from "./types";

export async function getSettlementCorrections(
  repo: ExpenseRepository,
  ctx: ExpenseContext,
  {
    householdId,
    periodStart,
    today = getTodayParis(),
  }: { householdId: string; periodStart: PeriodStart; today?: string },
): Promise<ActionResult<SettlementCorrectionLine[]>> {
  if (householdId !== ctx.householdId) {
    return err("FORBIDDEN", "Foyer non autorisé.");
  }

  const [memberIds, expenses] = await Promise.all([
    repo.getHouseholdMemberIds(householdId),
    repo.listAllExpensesForAdmin(householdId),
  ]);

  const lines: SettlementCorrectionLine[] = [];
  for (const expense of expenses) {
    // « Couverte » = comptée par la régularisation (connue alors, datée au
    // plus tard ce jour-là) ; côté actuel, même borne que le donut
    // (`incurredOn > periodStart` exclusif) et déjà engagée (4.2). Une
    // dépense redatée hors de cette fenêtre bascule dans le donut : elle
    // apparaît ici comme retirée.
    const known = expenseKnownAt(expense, periodStart.settledAt);
    const before = known && known.incurredOn <= periodStart.date ? known : null;
    const after =
      expense.deletedAt === null &&
      expense.incurredOn <= periodStart.date &&
      expense.incurredOn <= today
        ? expense
        : null;
    const kind = correctionKind(before, after);
    if (!kind) continue;

    const balanceDelta = computeBalanceDelta(
      before && toBalanceExpense(before),
      after && toBalanceExpense(after),
      memberIds,
    );
    if (Object.values(balanceDelta).every((cents) => cents === 0)) continue;

    const current = after ?? before ?? expense;
    lines.push({
      expenseId: expense.id,
      label: current.label,
      incurredOn: current.incurredOn,
      kind,
      amountCents:
        kind === "aid-added"
          ? addedAids(before, expense).reduce((sum, a) => sum + a.amountCents, 0)
          : current.grossCents,
      ...(kind === "modified" && before && before.grossCents !== current.grossCents
        ? { previousAmountCents: before.grossCents }
        : {}),
      balanceDelta,
    });
  }

  // Ordre chronologique de la date métier, puis par libellé (stable à l'écran).
  lines.sort((a, b) => a.incurredOn.localeCompare(b.incurredOn) || a.label.localeCompare(b.label));
  return ok(lines);
}

function correctionKind(
  before: StoredExpense | null,
  after: StoredExpense | null,
): SettlementCorrectionKind | null {
  if (!before && after) return "added";
  if (before && !after) return "deleted";
  if (!before || !after) return null;
  // Seules des aides ont été ajoutées (rien d'autre n'a bougé) : libellé dédié.
  const onlyAidsAdded =
    before.grossCents === after.grossCents &&
    before.payerId === after.payerId &&
    addedAids(before, after).length > 0 &&
    before.aids.every((a) => after.aids.some((b) => b.id === a.id));
  return onlyAidsAdded ? "aid-added" : "modified";
}

function addedAids(before: StoredExpense | null, after: StoredExpense) {
  const known = new Set((before?.aids ?? []).map((a) => a.id));
  return after.aids.filter((a) => !known.has(a.id));
}
