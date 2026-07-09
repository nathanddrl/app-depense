// @app/domain-recurrence — liste des charges récurrentes actives d'un foyer
// (spec ch.5.4, T-CR2). Lecture pure, aucun calcul : la génération d'occurrence
// (calc-engine) reste hors périmètre de cette action.

import { ok } from "@app/shared";
import type { ActionResult } from "@app/shared";
import type { RecurringTemplateRepository } from "./repository";
import type { RecurrenceContext, RecurringTemplate } from "./types";

export async function listRecurringTemplates(
  repo: RecurringTemplateRepository,
  ctx: RecurrenceContext,
): Promise<ActionResult<RecurringTemplate[]>> {
  const templates = await repo.listRecurringTemplatesForHousehold(ctx.householdId);
  return ok(templates);
}
