// @app/domain-expense — correction admin d'une dépense verrouillée (T-C8.3, DA14).
//
// Bypass STRICTEMENT isolé du verrou EXPENSE_LOCKED de `updateExpense` (ch.5.1/4.6,
// T-C6.4) : fonction séparée, non exportée nulle part ailleurs, jamais de flag sur
// `updateExpense` lui-même (qui reste intact, verrou inchangé). Mêmes validations
// de forme et même recompute des parts par calc-engine que le chemin normal —
// seul le verrou de régularisation est contourné, pas la validation métier.
//
// Traçabilité (DA-OPEN1, decisions-techniques.md, tranché 07/07/2026) : PAS de
// log dédié pour ces corrections. `updated_at` (patché ci-dessous comme pour
// une édition normale) suffit à tracer grossièrement à l'échelle d'un foyer à
// 2 utilisateurs. À reprendre seulement si un vrai back-office multi-admin
// voit le jour (qui-a-fait-quoi, audit externe).

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

export async function adminUpdateExpense(
  repo: ExpenseRepository,
  ctx: ExpenseContext,
  input: UpdateExpenseInput,
): Promise<ActionResult<Expense>> {
  // Revérification serveur (T-C8.1/T-C8.2) : jamais uniquement le layout `/admin`.
  if (ctx.role !== "admin") {
    return err("FORBIDDEN", "Réservé aux administrateurs.");
  }

  const { patch } = input;

  // 1) Charger l'existant (scope foyer) : absent → NOT_FOUND. AUCUN check
  // EXPENSE_LOCKED ici — c'est le bypass, réservé à ce chemin admin.
  const existing = await repo.getExpenseById(input.expenseId);
  if (!existing || existing.deletedAt !== null || existing.householdId !== ctx.householdId) {
    return err("NOT_FOUND", "Dépense introuvable.");
  }

  // 2) Validations de FORME — identiques à `updateExpense` (la correction admin
  // doit rester une donnée valide, seul le verrou est contourné).
  const formError = firstError(
    patch.label !== undefined ? validateLabel(patch.label) : null,
    patch.grossCents !== undefined ? validateAmountCents(patch.grossCents) : null,
    patch.incurredOn !== undefined ? validateIncurredOn(patch.incurredOn) : null,
    patch.shares !== undefined ? validateRatio(patch.shares) : null,
  );
  if (formError) return { ok: false, error: formError };

  // 3) Valeurs effectives (patch sinon existant) pour recomputer les parts.
  const grossCents = patch.grossCents ?? existing.grossCents;
  const payerId = patch.payerId ?? existing.payerId;
  const ratio: ShareInput[] =
    patch.shares ?? existing.shares.map((s) => ({ memberId: s.memberId, pct: s.pctSnapshot }));

  // 4) Validation CONTEXTUELLE : payeur/parts ∈ foyer.
  const memberIds = await repo.getHouseholdMemberIds(existing.householdId);
  const memberError = validateHouseholdMembers(memberIds, payerId, ratio);
  if (memberError) return { ok: false, error: memberError };

  // 5) Recompute des parts figées par le moteur (jamais un second calcul, DA4).
  let shares;
  try {
    shares = computeShareDTOs(grossCents, payerId, ratio);
  } catch (e) {
    if (e instanceof CalcPreconditionError) {
      return err("VALIDATION_ERROR", "Répartition invalide.", "shares");
    }
    throw e;
  }

  // 6) Patch scalaire minimal (seuls les champs fournis).
  const scalarPatch: ExpenseScalarPatch = {};
  if (patch.label !== undefined) scalarPatch.label = patch.label;
  if (patch.category !== undefined) scalarPatch.category = patch.category;
  if (patch.grossCents !== undefined) scalarPatch.grossCents = patch.grossCents;
  if (patch.payerId !== undefined) scalarPatch.payerId = patch.payerId;
  if (patch.incurredOn !== undefined) scalarPatch.incurredOn = patch.incurredOn;

  const expense = await repo.updateExpenseWithShares(input.expenseId, scalarPatch, shares);
  return ok(expense);
}
