// @app/domain-settlement — annulation/refus d'une régularisation (spec ch.5.3,
// D7 révisé, D16 v0.3, T-C6.3). L'initiateur (débiteur) ou le créancier peut
// annuler : simple changement de statut (`pending → cancelled`), le solde reste
// inchangé (aucune dépense n'a jamais été touchée, modèle ledger).

import { err, ok } from "@app/shared";
import type { ActionResult } from "@app/shared";
import type { SettlementRepository } from "./repository";
import { validateSettlementTransition } from "./transitions";
import type { CancelSettlementInput, Settlement, SettlementContext } from "./types";

export async function cancelSettlement(
  repo: SettlementRepository,
  ctx: SettlementContext,
  input: CancelSettlementInput,
): Promise<ActionResult<Settlement>> {
  // 1) Charger l'existant (scope RLS/foyer) : absent → NOT_FOUND.
  const existing = await repo.getSettlementById(input.settlementId);
  if (!existing || existing.householdId !== ctx.householdId) {
    return err("NOT_FOUND", "Régularisation introuvable.");
  }

  // 2) Initiateur ou créancier seulement (D16).
  if (ctx.memberId !== existing.initiatedBy && ctx.memberId !== existing.toMemberId) {
    return err(
      "FORBIDDEN",
      "Seuls l'initiateur ou le créancier peuvent annuler une régularisation.",
    );
  }

  // 3) Garde de transition réutilisée telle quelle (T-C6.1), pas de nouvelle logique.
  const transitionError = validateSettlementTransition(existing.status, "cancelled");
  if (transitionError) return { ok: false, error: transitionError };

  const settlement = await repo.cancelSettlement(input.settlementId);
  return ok(settlement);
}
