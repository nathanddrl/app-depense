// @app/domain-expense — helpers internes partagés par create/update.
//
// Le domaine ORCHESTRE, il ne recalcule jamais : les parts figées sortent
// exclusivement de `calc-engine.computeExpense` (archi ch.1.4 / DA4).

import { computeExpense } from "@app/calc-engine";
import type { AppError } from "@app/shared";
import type { ExpenseShareDTO, ShareInput } from "./types";

/**
 * Parts figées d'une dépense via le moteur (spec 4.1/4.3). Sans aide dans ce
 * chantier → net = brut. Peut lever `CalcPreconditionError` (filet, ch.7 valide en
 * amont) : les appelants l'interceptent et la mappent en `VALIDATION_ERROR`.
 */
export function computeShareDTOs(
  grossCents: number,
  payerId: string,
  ratio: ShareInput[],
): ExpenseShareDTO[] {
  const computed = computeExpense({ grossCents, payerId, ratio });
  return computed.shares.map((s) => ({
    memberId: s.memberId,
    cents: s.cents,
    pctSnapshot: s.pctSnapshot,
  }));
}

/**
 * Validation CONTEXTUELLE (touche la DB, donc ici et pas dans shared) : le payeur
 * et chaque membre porteur d'une part appartiennent au foyer (ch.7).
 */
export function validateHouseholdMembers(
  memberIds: string[],
  payerId: string,
  shares: ShareInput[],
): AppError | null {
  const members = new Set(memberIds);
  if (!members.has(payerId)) {
    return {
      code: "VALIDATION_ERROR",
      message: "Le payeur doit être un membre du foyer.",
      field: "payerId",
    };
  }
  for (const s of shares) {
    if (!members.has(s.memberId)) {
      return {
        code: "VALIDATION_ERROR",
        message: "Une part vise une personne hors du foyer.",
        field: "shares",
      };
    }
  }
  return null;
}
