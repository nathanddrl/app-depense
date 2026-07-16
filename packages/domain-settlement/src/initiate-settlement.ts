// @app/domain-settlement — déclenchement d'une régularisation (spec ch.5.3, D15
// révisé v0.5, D16 v0.3, T-C6.2). Le débiteur déclenche (« j'ai remboursé »),
// pour tout, partie, ou plus que le solde courant (D15 v0.5 : un montant
// supérieur inverse le solde — le créancier d'origine devient débiteur du
// surplus à la confirmation, cf. `@app/calc-engine.computeBalance`, l'algèbre
// du solde le supporte nativement, `Σ solde = 0` reste vrai). Modèle ledger
// (D7 révisé) : plus de gel des dépenses — le solde n'est réduit qu'à la
// confirmation (T-C6.3).

import { err, ok, validateAmountCents } from "@app/shared";
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
  if (input.balanceAmountCents === 0) {
    return err(
      "BALANCE_ALREADY_ZERO",
      "Le solde est déjà à zéro, aucune régularisation n'est nécessaire.",
    );
  }

  // 3) Montant demandé : entier positif (forme, ch.7). Plus de plafond au
  // solde courant (D15 v0.5) — un montant supérieur est accepté et inverse le
  // solde à la confirmation ; `balanceAmountCents` ne sert donc plus qu'à la
  // vérification de solde nul ci-dessus.
  const amountError = validateAmountCents(input.amountCents);
  if (amountError) {
    return err("VALIDATION_ERROR", amountError.message, amountError.field);
  }

  // 4) Seul le débiteur peut déclencher (D16).
  if (ctx.memberId !== input.fromMemberId) {
    return err("FORBIDDEN", "Seul le débiteur peut déclencher une régularisation.");
  }

  // 5) Une seule régularisation `pending` par foyer.
  const pending = await repo.getPendingSettlement(input.householdId);
  if (pending) {
    return err("SETTLEMENT_PENDING_EXISTS", "Une régularisation est déjà en cours pour ce foyer.");
  }

  // 6) Création atomique — aucune dépense n'est touchée (modèle ledger, D7 révisé).
  const settlement = await repo.createSettlement({
    householdId: input.householdId,
    amountCents: input.amountCents,
    fromMemberId: input.fromMemberId,
    toMemberId: input.toMemberId,
    initiatedBy: ctx.memberId,
  });
  return ok(settlement);
}
