// @app/domain-expense — borne basse de la période du donut de répartition
// (refonte solde, écran « d'où vient l'écart »). Un règlement confirmé ne
// remet PAS forcément le solde à zéro (D15 v0.5 : montant partiel, égal ou
// supérieur au solde, tous autorisés) — utiliser sa seule date comme borne
// de période casserait la cohérence avec le solde affiché au centre (modèle
// ledger, cumulé depuis toujours) dès qu'un règlement partiel existe : le
// donut ne montrerait presque rien alors que le solde reste conséquent. On
// ne retient donc que le DERNIER règlement confirmé qui, rejoué sur
// l'historique jusqu'à sa date, ramène RÉELLEMENT le solde à zéro — sinon,
// la période repart depuis le début (`null`).

import { computeExpense, computeBalance } from "@app/calc-engine";
import type { BalanceExpense, SettlementForBalance } from "@app/calc-engine";
import { err, ok } from "@app/shared";
import type { ActionResult } from "@app/shared";
import type { ExpenseRepository } from "./repository";
import type { ConfirmedSettlementForPeriod, ExpenseContext } from "./types";

export async function findPeriodStart(
  repo: ExpenseRepository,
  ctx: ExpenseContext,
  {
    householdId,
    settlements,
  }: { householdId: string; settlements: ConfirmedSettlementForPeriod[] },
): Promise<ActionResult<string | null>> {
  if (householdId !== ctx.householdId) {
    return err("FORBIDDEN", "Foyer non autorisé.");
  }

  const [memberIds, expenses] = await Promise.all([
    repo.getHouseholdMemberIds(householdId),
    repo.listExpenses(householdId, {}),
  ]);

  const sorted = [...settlements].sort((a, b) => a.confirmedAt.localeCompare(b.confirmedAt));

  let lastZeroingDate: string | null = null;
  for (const settlement of sorted) {
    const cutoff = settlement.confirmedAt.slice(0, 10);

    const settlementsUpToHere: SettlementForBalance[] = sorted
      .filter((s) => s.confirmedAt <= settlement.confirmedAt)
      .map((s) => ({
        fromMemberId: s.fromMemberId,
        toMemberId: s.toMemberId,
        amountCents: s.amountCents,
        status: "confirmed",
      }));

    const balanceExpenses: BalanceExpense[] = expenses
      .filter((e) => e.incurredOn <= cutoff)
      .map((e) => {
        const { effectiveAids } = computeExpense({
          grossCents: e.grossCents,
          payerId: e.payerId,
          ratio: e.shares.map((s) => ({ memberId: s.memberId, pct: s.pctSnapshot })),
          aids: e.aids,
        });
        return {
          grossCents: e.grossCents,
          payerId: e.payerId,
          shares: e.shares.map((s) => ({ memberId: s.memberId, cents: s.cents })),
          effectiveAids,
        };
      });

    const balances = computeBalance(balanceExpenses, memberIds, settlementsUpToHere);
    if (Object.values(balances).every((amount) => amount === 0)) {
      lastZeroingDate = cutoff;
    }
  }

  return ok(lastZeroingDate);
}
