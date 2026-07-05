// @app/domain-settlement — garde de transition de statut (spec ch.5.3, D16 v0.3).
//
// Une seule régularisation `pending` par foyer, sans preuve de virement (double
// attestation) : le débiteur déclenche, le créancier confirme. Transitions
// légales UNIQUEMENT `pending → confirmed` et `pending → cancelled` ; les états
// `confirmed`/`cancelled` sont terminaux. Réutilisée telle quelle par les
// actions à venir (initiateSettlement/confirmSettlement/cancelSettlement,
// T-C6.2/T-C6.3).

import type { AppError } from "@app/shared";
import type { SettlementStatus } from "./types";

const LEGAL_TRANSITIONS: Record<SettlementStatus, SettlementStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: [],
  cancelled: [],
};

/** Pure : la transition `from → to` est-elle autorisée ? */
export function canTransitionSettlement(from: SettlementStatus, to: SettlementStatus): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

/** Valide une transition ; `null` si légale, sinon `AppError` (code `CONFLICT`). */
export function validateSettlementTransition(
  from: SettlementStatus,
  to: SettlementStatus,
): AppError | null {
  if (canTransitionSettlement(from, to)) return null;
  return {
    code: "CONFLICT",
    message: `Transition de statut refusée : ${from} → ${to}.`,
  };
}
