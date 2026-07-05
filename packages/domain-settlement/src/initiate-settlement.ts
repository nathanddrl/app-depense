// @app/domain-settlement — déclenchement d'une régularisation (spec ch.5.3, D16
// v0.3, T-C6.2). Le débiteur déclenche (« j'ai remboursé »), le solde n'est figé
// qu'à la confirmation (T-C6.3) — ici on fige seulement le montant et on gèle les
// dépenses ouvertes du foyer, qui comptent encore dans le solde tant que le
// settlement est `pending` (§4.2, déjà respecté par `getBalance`).

import { err, ok } from "@app/shared";
import type { ActionResult } from "@app/shared";
import type { SettlementRepository } from "./repository";
import type { InitiateSettlementInput, Settlement, SettlementContext } from "./types";

export async function initiateSettlement(
  repo: SettlementRepository,
  ctx: SettlementContext,
  input: InitiateSettlementInput,
): Promise<ActionResult<Settlement>> {
  // 1) Le foyer est imposé par le seam (scope autoritaire), jamais par le client.
  if (input.householdId !== ctx.householdId) {
    return err("FORBIDDEN", "Foyer non autorisé.");
  }

  // 2) Solde nul : rien à régulariser.
  if (input.amountCents === 0) {
    return err(
      "BALANCE_ALREADY_ZERO",
      "Le solde est déjà à zéro, aucune régularisation n'est nécessaire.",
    );
  }

  // 3) Seul le débiteur peut déclencher (D16).
  if (ctx.memberId !== input.fromMemberId) {
    return err("FORBIDDEN", "Seul le débiteur peut déclencher une régularisation.");
  }

  // 4) Une seule régularisation `pending` par foyer.
  const pending = await repo.getPendingSettlement(input.householdId);
  if (pending) {
    return err("SETTLEMENT_PENDING_EXISTS", "Une régularisation est déjà en cours pour ce foyer.");
  }

  // 5) Création atomique + gel des dépenses ouvertes du foyer.
  const settlement = await repo.createSettlementAndFreezeExpenses({
    householdId: input.householdId,
    amountCents: input.amountCents,
    fromMemberId: input.fromMemberId,
    toMemberId: input.toMemberId,
    initiatedBy: ctx.memberId,
  });
  return ok(settlement);
}
