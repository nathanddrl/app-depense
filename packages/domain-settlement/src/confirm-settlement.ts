// @app/domain-settlement — confirmation d'une régularisation (spec ch.5.3, D16
// v0.3, T-C6.3). Le créancier confirme (« j'ai reçu ») : le solde est figé à
// zéro, les dépenses rattachées deviennent définitivement immuables (elles
// restent gelées, seul le statut du settlement change).

import { err, ok } from "@app/shared";
import type { ActionResult } from "@app/shared";
import type { SettlementRepository } from "./repository";
import { validateSettlementTransition } from "./transitions";
import type { ConfirmSettlementInput, Settlement, SettlementContext } from "./types";

export async function confirmSettlement(
  repo: SettlementRepository,
  ctx: SettlementContext,
  input: ConfirmSettlementInput,
): Promise<ActionResult<Settlement>> {
  // 1) Charger l'existant (scope RLS/foyer) : absent → NOT_FOUND.
  const existing = await repo.getSettlementById(input.settlementId);
  if (!existing || existing.householdId !== ctx.householdId) {
    return err("NOT_FOUND", "Régularisation introuvable.");
  }

  // 2) Seul le créancier peut confirmer (D16) — exclut de facto l'auto-confirmation
  // par l'initiateur, qui est toujours le débiteur.
  if (ctx.memberId !== existing.toMemberId) {
    return err("FORBIDDEN", "Seul le créancier peut confirmer une régularisation.");
  }

  // 3) Garde de transition réutilisée telle quelle (T-C6.1), pas de nouvelle logique.
  const transitionError = validateSettlementTransition(existing.status, "confirmed");
  if (transitionError) return { ok: false, error: transitionError };

  const settlement = await repo.confirmSettlement(input.settlementId, ctx.memberId);
  return ok(settlement);
}
