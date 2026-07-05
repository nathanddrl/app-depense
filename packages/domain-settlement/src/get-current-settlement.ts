// @app/domain-settlement — lecture de la régularisation `pending` courante du
// foyer, s'il y en a une (ch.5.3, T-C6.6). Sert l'UI web (bandeau de
// confirmation/annulation) : une seule pending par foyer (D16), donc pas de
// filtre supplémentaire à passer.

import { err, ok } from "@app/shared";
import type { ActionResult } from "@app/shared";
import type { SettlementRepository } from "./repository";
import type { Settlement, SettlementContext } from "./types";

export async function getCurrentSettlement(
  repo: SettlementRepository,
  ctx: SettlementContext,
  { householdId }: { householdId: string },
): Promise<ActionResult<Settlement | null>> {
  if (householdId !== ctx.householdId) {
    return err("FORBIDDEN", "Foyer non autorisé.");
  }

  const pending = await repo.getPendingSettlement(householdId);
  if (!pending) return ok(null);

  const settlement = await repo.getSettlementById(pending.id);
  return ok(settlement);
}
