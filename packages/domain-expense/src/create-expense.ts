// @app/domain-expense — création d'une dépense ponctuelle (spec ch.5.1, US1-US4).

import { CalcPreconditionError } from "@app/calc-engine";
import {
  err,
  firstError,
  ok,
  validateAmountCents,
  validateIncurredOn,
  validateLabel,
  validateRatio,
} from "@app/shared";
import type { ActionResult } from "@app/shared";
import { computeShareDTOs, validateHouseholdMembers } from "./internal";
import type { ExpenseRepository } from "./repository";
import type { CreateExpenseInput, Expense, ExpenseContext } from "./types";

/**
 * Flux (ordre inviolable) : formes (shared) → contexte (foyer/membres, via repo) →
 * moteur (parts figées) → persistance. La validation amont garantit que le
 * `CalcPreconditionError` du moteur ne se déclenche jamais (filet → VALIDATION_ERROR).
 */
export async function createExpense(
  repo: ExpenseRepository,
  ctx: ExpenseContext,
  input: CreateExpenseInput,
): Promise<ActionResult<Expense>> {
  // Le foyer est imposé par le seam (scope autoritaire), jamais par le client.
  if (input.householdId !== ctx.householdId) {
    return err("FORBIDDEN", "Foyer non autorisé.");
  }

  // 1) Validations de FORME (ch.7).
  const formError = firstError(
    validateLabel(input.label),
    validateAmountCents(input.grossCents),
    validateIncurredOn(input.incurredOn),
    validateRatio(input.shares),
  );
  if (formError) return { ok: false, error: formError };

  // 2) Validation CONTEXTUELLE : payeur et parts ∈ foyer.
  const memberIds = await repo.getHouseholdMemberIds(ctx.householdId);
  const memberError = validateHouseholdMembers(memberIds, input.payerId, input.shares);
  if (memberError) return { ok: false, error: memberError };

  // 3) Parts figées calculées PAR le moteur (jamais par le domaine).
  let shares;
  try {
    shares = computeShareDTOs(input.grossCents, input.payerId, input.shares);
  } catch (e) {
    if (e instanceof CalcPreconditionError) {
      return err("VALIDATION_ERROR", "Répartition invalide.", "shares");
    }
    throw e;
  }

  // 4) Persistance atomique dépense + parts.
  const expense = await repo.insertExpenseWithShares(
    {
      householdId: ctx.householdId,
      label: input.label,
      category: input.category,
      grossCents: input.grossCents,
      payerId: input.payerId,
      incurredOn: input.incurredOn,
      source: "manual",
      createdBy: ctx.memberId,
    },
    shares,
  );

  return ok(expense);
}
