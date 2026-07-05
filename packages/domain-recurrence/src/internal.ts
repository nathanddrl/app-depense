// @app/domain-recurrence — helpers internes partagés entre les use-cases.
//
// Pas d'appel calc-engine ici : `shares_config` reste déclaratif (%), le calcul
// des parts figées se fait à la génération d'occurrence (T-C7.2, hors scope).

import type { AppError } from "@app/shared";
import type { ShareConfigInput } from "./types";

/**
 * Validation CONTEXTUELLE (touche la DB, donc ici et pas dans shared) : le
 * payeur, chaque part et chaque bénéficiaire d'aide doivent être membres du foyer.
 */
export function validateHouseholdMembers(
  memberIds: string[],
  payerId: string,
  shares: ShareConfigInput[],
  aidBeneficiaryIds: string[] = [],
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
  for (const beneficiaryId of aidBeneficiaryIds) {
    if (!members.has(beneficiaryId)) {
      return {
        code: "VALIDATION_ERROR",
        message: "Le bénéficiaire d'une aide récurrente doit être un membre du foyer.",
        field: "aids",
      };
    }
  }
  return null;
}
