// @app/domain-expense — lecture du solde courant (spec 4.2, ch.6.2 `getBalance`,
// D7 révisé). Le domaine charge les dépenses actives via le port et délègue tout
// le calcul à calc-engine (DA4) : aucune arithmétique de solde ici. Les
// règlements confirmés (ajustements ledger, D15 révisé) sont fournis par
// l'appelant — `domain-expense` ne peut pas importer `domain-settlement` (DA4),
// cette composition vit dans `apps/web/app/actions.ts`.

import { computeExpense, computeBalance, reduceBalanceTwoMembers } from "@app/calc-engine";
import type { BalanceExpense, SettlementForBalance } from "@app/calc-engine";
import { err, ok, getTodayParis } from "@app/shared";
import type { ActionResult } from "@app/shared";
import type { ExpenseRepository } from "./repository";
import type { Balance, ExpenseContext } from "./types";

export async function getBalance(
  repo: ExpenseRepository,
  ctx: ExpenseContext,
  {
    householdId,
    settlements = [],
    today = getTodayParis(),
  }: { householdId: string; settlements?: SettlementForBalance[]; today?: string },
): Promise<ActionResult<Balance>> {
  // Le foyer est imposé par le seam (scope autoritaire), jamais par le client.
  if (householdId !== ctx.householdId) {
    return err("FORBIDDEN", "Foyer non autorisé.");
  }

  const [memberIds, rows] = await Promise.all([
    repo.getHouseholdMemberIds(householdId),
    repo.listExpensesForBalance(householdId),
  ]);

  // Une dépense datée dans le futur (ex. occurrence récurrente générée en
  // avance, D12) n'est pas encore engagée : exclue du solde tant que sa date
  // n'est pas atteinte (4.2, decisions-techniques.md « Solde & onboarding »).
  const activeRows = rows.filter((row) => row.incurredOn <= today);

  const expenses: BalanceExpense[] = activeRows.map((row) => {
    // Seules les aides effectives (post-plafond 4.4) comptent dans le solde ;
    // les parts déjà figées à la création/édition ne sont pas recalculées ici.
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
  });

  const balances = computeBalance(expenses, memberIds, settlements);
  const reduced = reduceBalanceTwoMembers(balances);

  if (!reduced) {
    const [from = "", to = ""] = memberIds;
    return ok({ from, to, amountCents: 0 });
  }

  return ok(reduced);
}
