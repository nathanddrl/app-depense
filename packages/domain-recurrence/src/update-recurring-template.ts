// @app/domain-recurrence — édition d'un template récurrent (spec ch.5.4, T-C7.1).
//
// Patch scalaire minimal (seuls les champs fournis sont validés/persistés). Les
// aides récurrentes existantes ne sont pas éditables via ce patch (scope limité
// au CRUD du template — l'édition d'aides individuelles est hors périmètre de
// cette carte, comme domain-aid sépare `addAid`/`removeAid` de l'édition dépense).
//
// Non-rétroactivité (D13, T-C7.3) : CORRECTE PAR CONSTRUCTION, aucune correction
// nécessaire. `updateRecurringTemplate` ne touche QUE la ligne `recurring_template`
// (`repo.updateRecurringTemplate`, cf. `packages/db/src/recurring-repository.ts`) ;
// aucune cascade vers `expense`/`expense_share`/`recurring_occurrence` n'existe
// nulle part dans ce domaine. Les parts des occurrences déjà générées sont figées
// à la génération (`runRecurringGeneration`, via `calc-engine`) et ne sont JAMAIS
// recalculées depuis le template — modifier `amountCents` ici n'affecte que les
// générations futures, qui relisent le template à jour au moment de l'appel.

import {
  err,
  firstError,
  ok,
  validateAmountCents,
  validateDayOfMonth,
  validateLabel,
  validateRatio,
} from "@app/shared";
import type { ActionResult } from "@app/shared";
import { validateHouseholdMembers } from "./internal";
import type { RecurringTemplateRepository, RecurringTemplateScalarPatch } from "./repository";
import type { RecurrenceContext, RecurringTemplate, UpdateRecurringTemplateInput } from "./types";

export async function updateRecurringTemplate(
  repo: RecurringTemplateRepository,
  ctx: RecurrenceContext,
  input: UpdateRecurringTemplateInput,
): Promise<ActionResult<RecurringTemplate>> {
  const { patch } = input;

  // 1) Charger l'existant (scope RLS/foyer) : absent → NOT_FOUND.
  const existing = await repo.getRecurringTemplateById(input.templateId);
  if (!existing || existing.householdId !== ctx.householdId) {
    return err("NOT_FOUND", "Modèle récurrent introuvable.");
  }

  // 2) Validations de FORME sur les seuls champs fournis.
  const formError = firstError(
    patch.label !== undefined ? validateLabel(patch.label) : null,
    patch.amountCents !== undefined ? validateAmountCents(patch.amountCents) : null,
    patch.dayOfMonth !== undefined ? validateDayOfMonth(patch.dayOfMonth) : null,
    patch.shares !== undefined ? validateRatio(patch.shares) : null,
  );
  if (formError) return { ok: false, error: formError };

  // 3) Valeurs effectives (patch sinon existant) pour la validation contextuelle.
  const payerId = patch.payerId ?? existing.payerId;
  const shares = patch.shares ?? existing.shares;

  // 4) Validation CONTEXTUELLE : payeur/parts ∈ foyer.
  const memberIds = await repo.getHouseholdMemberIds(existing.householdId);
  const memberError = validateHouseholdMembers(memberIds, payerId, shares);
  if (memberError) return { ok: false, error: memberError };

  // 5) Patch scalaire minimal (seuls les champs fournis).
  const scalarPatch: RecurringTemplateScalarPatch = {};
  if (patch.label !== undefined) scalarPatch.label = patch.label;
  if (patch.category !== undefined) scalarPatch.category = patch.category;
  if (patch.amountCents !== undefined) scalarPatch.amountCents = patch.amountCents;
  if (patch.payerId !== undefined) scalarPatch.payerId = patch.payerId;
  if (patch.dayOfMonth !== undefined) scalarPatch.dayOfMonth = patch.dayOfMonth;
  if (patch.shares !== undefined) scalarPatch.shares = patch.shares;

  const template = await repo.updateRecurringTemplate(input.templateId, scalarPatch);
  return ok(template);
}
