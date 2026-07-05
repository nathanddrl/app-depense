// @app/domain-expense — édition d'une dépense ouverte (spec ch.5.1 / 4.6).
//
// À l'édition, les parts sont RECOMPUTÉES (nouveau snapshot figé) tant que la
// dépense est ouverte. Une dépense rattachée à un settlement est verrouillée
// (`EXPENSE_LOCKED`), qu'il soit `pending` ou `confirmed` (T-C6.4) — seul
// `settlement_id IS NOT NULL` compte, jamais le statut du settlement.

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
import type { ExpenseRepository, ExpenseScalarPatch } from "./repository";
import type { Expense, ExpenseContext, ShareInput, UpdateExpenseInput } from "./types";

export async function updateExpense(
  repo: ExpenseRepository,
  ctx: ExpenseContext,
  input: UpdateExpenseInput,
): Promise<ActionResult<Expense>> {
  const { patch } = input;

  // 1) Charger l'existant (scope RLS/foyer) : absent → NOT_FOUND.
  const existing = await repo.getExpenseById(input.expenseId);
  if (!existing || existing.deletedAt !== null || existing.householdId !== ctx.householdId) {
    return err("NOT_FOUND", "Dépense introuvable.");
  }

  // 2) Verrou de régularisation (ch.7 / D7, T-C6.4).
  if (existing.settlementId !== null) {
    return err(
      "EXPENSE_LOCKED",
      "Cette dépense est rattachée à une régularisation et n'est plus modifiable.",
    );
  }

  // 3) Validations de FORME sur les seuls champs fournis.
  const formError = firstError(
    patch.label !== undefined ? validateLabel(patch.label) : null,
    patch.grossCents !== undefined ? validateAmountCents(patch.grossCents) : null,
    patch.incurredOn !== undefined ? validateIncurredOn(patch.incurredOn) : null,
    patch.shares !== undefined ? validateRatio(patch.shares) : null,
  );
  if (formError) return { ok: false, error: formError };

  // 4) Valeurs effectives (patch sinon existant) pour recomputer les parts.
  const grossCents = patch.grossCents ?? existing.grossCents;
  const payerId = patch.payerId ?? existing.payerId;
  const ratio: ShareInput[] =
    patch.shares ?? existing.shares.map((s) => ({ memberId: s.memberId, pct: s.pctSnapshot }));

  // 5) Validation CONTEXTUELLE : payeur/parts ∈ foyer.
  const memberIds = await repo.getHouseholdMemberIds(existing.householdId);
  const memberError = validateHouseholdMembers(memberIds, payerId, ratio);
  if (memberError) return { ok: false, error: memberError };

  // 6) Recompute des parts figées par le moteur.
  let shares;
  try {
    shares = computeShareDTOs(grossCents, payerId, ratio);
  } catch (e) {
    if (e instanceof CalcPreconditionError) {
      return err("VALIDATION_ERROR", "Répartition invalide.", "shares");
    }
    throw e;
  }

  // 7) Patch scalaire minimal (seuls les champs fournis).
  const scalarPatch: ExpenseScalarPatch = {};
  if (patch.label !== undefined) scalarPatch.label = patch.label;
  if (patch.category !== undefined) scalarPatch.category = patch.category;
  if (patch.grossCents !== undefined) scalarPatch.grossCents = patch.grossCents;
  if (patch.payerId !== undefined) scalarPatch.payerId = patch.payerId;
  if (patch.incurredOn !== undefined) scalarPatch.incurredOn = patch.incurredOn;

  const expense = await repo.updateExpenseWithShares(input.expenseId, scalarPatch, shares);
  return ok(expense);
}
