// @app/domain-recurrence — désactivation d'un template récurrent (spec ch.5.4).
//
// Simple UPDATE `active = false`, nativement atomique (pas de RPC nécessaire,
// même précédent que `confirmSettlement`). Jamais de suppression : l'historique
// déjà généré (`recurring_occurrence`, T-C7.2) reste intact. Idempotent :
// désactiver un template déjà inactif reste un succès, pas de code d'erreur dédié.

import { ok, err } from "@app/shared";
import type { ActionResult } from "@app/shared";
import type { RecurringTemplateRepository } from "./repository";
import type { DeactivateRecurringTemplateInput, RecurrenceContext } from "./types";

export async function deactivateRecurringTemplate(
  repo: RecurringTemplateRepository,
  ctx: RecurrenceContext,
  input: DeactivateRecurringTemplateInput,
): Promise<ActionResult<{ id: string; active: false }>> {
  // 1) Charger l'existant (scope RLS/foyer) : absent → NOT_FOUND.
  const existing = await repo.getRecurringTemplateById(input.templateId);
  if (!existing || existing.householdId !== ctx.householdId) {
    return err("NOT_FOUND", "Modèle récurrent introuvable.");
  }

  // 2) Désactivation idempotente.
  const result = await repo.deactivateRecurringTemplate(input.templateId);
  return ok(result);
}
