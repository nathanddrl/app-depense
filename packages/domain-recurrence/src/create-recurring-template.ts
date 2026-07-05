// @app/domain-recurrence — création d'un template récurrent + ses aides
// (spec ch.5.4, T-C7.1). Aucun calcul de parts figées ici : `shares_config` est
// déclaratif (%), résolu en centimes uniquement à la génération d'occurrence
// (T-C7.2, hors scope de cette carte).

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
import type { RecurringTemplateRepository } from "./repository";
import type { CreateRecurringTemplateInput, RecurrenceContext, RecurringTemplate } from "./types";

export async function createRecurringTemplate(
  repo: RecurringTemplateRepository,
  ctx: RecurrenceContext,
  input: CreateRecurringTemplateInput,
): Promise<ActionResult<RecurringTemplate>> {
  const aids = input.aids ?? [];

  // 1) Autorité : le foyer est imposé par le seam, jamais par le client.
  if (input.householdId !== ctx.householdId) {
    return err("FORBIDDEN", "Vous ne pouvez créer un modèle que pour votre propre foyer.");
  }

  // 2) Validations de FORME.
  const formError = firstError(
    validateLabel(input.label),
    validateAmountCents(input.amountCents),
    validateDayOfMonth(input.dayOfMonth),
    validateRatio(input.shares),
    ...aids.flatMap((a) => [validateLabel(a.label), validateAmountCents(a.amountCents)]),
  );
  if (formError) return { ok: false, error: formError };

  // 3) Validation CONTEXTUELLE : payeur/parts/bénéficiaires d'aides ∈ foyer.
  const memberIds = await repo.getHouseholdMemberIds(ctx.householdId);
  const memberError = validateHouseholdMembers(
    memberIds,
    input.payerId,
    input.shares,
    aids.map((a) => a.beneficiaryId),
  );
  if (memberError) return { ok: false, error: memberError };

  // 4) Persistance NON ATOMIQUE (même précédent que `updateExpenseWithShares`/
  // `addAid`, documenté côté @app/db) : insertion du template puis des aides.
  const template = await repo.createRecurringTemplateWithAids(
    {
      householdId: ctx.householdId,
      label: input.label,
      category: input.category,
      amountCents: input.amountCents,
      payerId: input.payerId,
      dayOfMonth: input.dayOfMonth,
      shares: input.shares,
    },
    aids.map((a) => ({
      beneficiaryId: a.beneficiaryId,
      label: a.label,
      amountCents: a.amountCents,
    })),
  );
  return ok(template);
}
