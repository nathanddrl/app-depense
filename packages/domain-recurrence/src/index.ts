// @app/domain-recurrence — baril public. Orchestration des templates récurrents,
// de leurs aides (spec ch.5.4, T-C7.1) et de la génération mensuelle des
// occurrences avec bord de mois (T-C7.2/T-C7.3, D14). Importe calc-engine +
// shared + db (type-only), jamais un autre domain-*. Pas de route cron (T-C7.4).

export { createRecurringTemplate } from "./create-recurring-template";
export { updateRecurringTemplate } from "./update-recurring-template";
export { deactivateRecurringTemplate } from "./deactivate-recurring-template";
export { listRecurringTemplates } from "./list-recurring-templates";
export { runRecurringGeneration } from "./run-recurring-generation";

export type {
  RecurringTemplateRepository,
  NewRecurringTemplate,
  NewRecurringAid,
  RecurringTemplateScalarPatch,
  StoredRecurringTemplate,
  RecurringShareDTO,
  TemplateForGeneration,
  GenerateOccurrenceInput,
  GeneratedOccurrence,
} from "./repository";

export type {
  RecurringGenerationOutcome,
  RecurringGenerationSummary,
} from "./run-recurring-generation";

export type {
  Category,
  RecurrenceContext,
  ShareConfigInput,
  NewRecurringAidInput,
  CreateRecurringTemplateInput,
  UpdateRecurringTemplateInput,
  DeactivateRecurringTemplateInput,
  RecurringAidDTO,
  RecurringTemplate,
} from "./types";
