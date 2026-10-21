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
//
// Le rejeu se fait sur les dépenses TELLES QU'ELLES ÉTAIENT CONNUES à la
// confirmation (`expenseKnownAt`), pas sur leur état actuel : une correction
// ultérieure d'une dépense déjà couverte (doublon supprimé, aide ajoutée,
// occurrence générée en retard) ne doit pas disqualifier le règlement — sinon
// l'écran retombe en silence sur une période bien trop large. Ces corrections
// sont restituées à part (`getSettlementCorrections`).

import { computeBalance } from "@app/calc-engine";
import type { SettlementForBalance } from "@app/calc-engine";
import { err, ok, toDateParis } from "@app/shared";
import type { ActionResult } from "@app/shared";
import { expenseKnownAt, toBalanceExpense } from "./internal";
import type { ExpenseRepository, StoredExpense } from "./repository";
import type { ConfirmedSettlementForPeriod, ExpenseContext, PeriodStart } from "./types";

export async function findPeriodStart(
  repo: ExpenseRepository,
  ctx: ExpenseContext,
  {
    householdId,
    settlements,
  }: { householdId: string; settlements: ConfirmedSettlementForPeriod[] },
): Promise<ActionResult<PeriodStart | null>> {
  if (householdId !== ctx.householdId) {
    return err("FORBIDDEN", "Foyer non autorisé.");
  }

  const [memberIds, expenses] = await Promise.all([
    repo.getHouseholdMemberIds(householdId),
    repo.listAllExpensesForAdmin(householdId),
  ]);

  const sorted = [...settlements].sort(
    (a, b) => Date.parse(a.confirmedAt) - Date.parse(b.confirmedAt),
  );

  let lastZeroing: PeriodStart | null = null;
  for (const settlement of sorted) {
    // Date métier de Paris (D4), comparable à `incurred_on` — pas la date UTC.
    const cutoff = toDateParis(settlement.confirmedAt);

    const settlementsUpToHere: SettlementForBalance[] = sorted
      .filter((s) => Date.parse(s.confirmedAt) <= Date.parse(settlement.confirmedAt))
      .map((s) => ({
        fromMemberId: s.fromMemberId,
        toMemberId: s.toMemberId,
        amountCents: s.amountCents,
        status: "confirmed",
      }));

    // Filtre de date APRÈS reconstitution : c'est la date connue à l'époque
    // qui compte (une dépense a pu être redatée depuis).
    const balanceExpenses = expenses
      .map((e) => expenseKnownAt(e, settlement.confirmedAt))
      .filter((e): e is StoredExpense => e !== null && e.incurredOn <= cutoff)
      .map(toBalanceExpense);

    const balances = computeBalance(balanceExpenses, memberIds, settlementsUpToHere);
    if (Object.values(balances).every((amount) => amount === 0)) {
      lastZeroing = { date: cutoff, settledAt: settlement.confirmedAt };
    }
  }

  return ok(lastZeroing);
}
