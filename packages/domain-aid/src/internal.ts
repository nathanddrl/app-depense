// @app/domain-aid — helpers internes partagés par addAid/removeAid.
//
// Le domaine ORCHESTRE, il ne recalcule jamais : les parts figées sortent
// exclusivement de `calc-engine.computeExpense` (archi ch.1.4 / DA4). L'aide
// s'applique AVANT le ratio (elle bénéficie à la charge commune, D9/D10) — ce
// calcul vit exclusivement dans `computeExpense`, jamais dupliqué ici.

import { computeExpense } from "@app/calc-engine";
import type { AidInput } from "@app/calc-engine";
import type { AppError, AppWarning } from "@app/shared";
import type { ExpenseShareDTO } from "./types";

/**
 * Parts figées d'une dépense après application des aides (spec 4.1/4.3/4.4). Peut
 * lever `CalcPreconditionError` (filet, ch.7 valide en amont) : les appelants
 * l'interceptent et la mappent en `VALIDATION_ERROR`.
 */
export function computeSharesAfterAids(
  grossCents: number,
  payerId: string,
  ratio: { memberId: string; pct: number }[],
  aids: AidInput[],
): { shares: ExpenseShareDTO[]; warnings: AppWarning[] } {
  const computed = computeExpense({ grossCents, payerId, ratio, aids });
  const shares = computed.shares.map((s) => ({
    memberId: s.memberId,
    cents: s.cents,
    pctSnapshot: s.pctSnapshot,
  }));
  const warnings: AppWarning[] = computed.warnings.map((code) => ({
    code,
    message: "Le total des aides dépasse la charge : la dépense est ramenée à 0.",
  }));
  return { shares, warnings };
}

/**
 * Validation CONTEXTUELLE (touche la DB, donc ici et pas dans shared) : le
 * bénéficiaire d'une aide appartient au foyer de la dépense (ch.7).
 */
export function validateBeneficiaryInHousehold(
  memberIds: string[],
  beneficiaryId: string,
): AppError | null {
  if (!memberIds.includes(beneficiaryId)) {
    return {
      code: "VALIDATION_ERROR",
      message: "Le bénéficiaire de l'aide doit être un membre du foyer.",
      field: "beneficiaryId",
    };
  }
  return null;
}
