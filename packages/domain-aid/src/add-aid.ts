// @app/domain-aid — rattachement d'une aide à une dépense (spec ch.5.2, D9/D10).
//
// L'aide s'applique AVANT le ratio (elle bénéficie à la charge commune, pas au
// membre qui la perçoit) : les parts figées de la dépense sont recomputées via
// `calc-engine` à chaque ajout. Une dépense rattachée à un settlement est
// verrouillée (`EXPENSE_LOCKED`).

import { CalcPreconditionError } from "@app/calc-engine";
import { err, firstError, ok, validateAmountCents, validateLabel } from "@app/shared";
import type { ActionResult } from "@app/shared";
import { computeSharesAfterAids, validateBeneficiaryInHousehold } from "./internal";
import type { AidRepository } from "./repository";
import type { AddAidInput, AidContext, Expense } from "./types";

export async function addAid(
  repo: AidRepository,
  ctx: AidContext,
  input: AddAidInput,
): Promise<ActionResult<Expense>> {
  // 1) Charger la dépense (scope RLS) : absente → NOT_FOUND.
  const expense = await repo.getExpenseForAid(input.expenseId);
  if (!expense) {
    return err("NOT_FOUND", "Dépense introuvable.");
  }

  // 2) Autorité : le foyer est imposé par le seam, jamais par le client.
  if (expense.householdId !== ctx.householdId) {
    return err("FORBIDDEN", "Cette dépense n'appartient pas à votre foyer.");
  }

  // 3) Verrou de régularisation (ch.7 / D7).
  if (expense.settlementId !== null) {
    return err(
      "EXPENSE_LOCKED",
      "Cette dépense est rattachée à une régularisation et n'est plus modifiable.",
    );
  }

  // 4) Validations de FORME.
  const formError = firstError(validateLabel(input.label), validateAmountCents(input.amountCents));
  if (formError) return { ok: false, error: formError };

  // 5) Validation CONTEXTUELLE : bénéficiaire ∈ foyer.
  const memberIds = await repo.getHouseholdMemberIds(expense.householdId);
  const memberError = validateBeneficiaryInHousehold(memberIds, input.beneficiaryId);
  if (memberError) return { ok: false, error: memberError };

  // 6) Recompute des parts figées par le moteur (aide ajoutée aux existantes).
  let shares;
  let warnings;
  try {
    const computed = computeSharesAfterAids(expense.grossCents, expense.payerId, expense.ratio, [
      ...expense.aids.map((a) => ({ beneficiaryId: a.beneficiaryId, amountCents: a.amountCents })),
      { beneficiaryId: input.beneficiaryId, amountCents: input.amountCents },
    ]);
    shares = computed.shares;
    warnings = computed.warnings;
  } catch (e) {
    if (e instanceof CalcPreconditionError) {
      return err("VALIDATION_ERROR", "Répartition invalide.", "shares");
    }
    throw e;
  }

  // 7) Persistance atomique de l'aide + des nouvelles parts.
  const updated = await repo.addAid(
    {
      expenseId: input.expenseId,
      beneficiaryId: input.beneficiaryId,
      label: input.label,
      amountCents: input.amountCents,
    },
    shares,
  );
  return ok(updated, warnings);
}
