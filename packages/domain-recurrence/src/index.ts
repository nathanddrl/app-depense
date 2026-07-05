// @app/domain-recurrence — baril public. Orchestration des templates récurrents
// et de leurs aides (spec ch.5.4, T-C7.1). Importe calc-engine + shared + db
// (type-only), jamais un autre domain-*. Ne génère aucune occurrence (T-C7.2).

export { createRecurringTemplate } from "./create-recurring-template";
export { updateRecurringTemplate } from "./update-recurring-template";
export { deactivateRecurringTemplate } from "./deactivate-recurring-template";

export type {
  RecurringTemplateRepository,
  NewRecurringTemplate,
  NewRecurringAid,
  RecurringTemplateScalarPatch,
  StoredRecurringTemplate,
} from "./repository";

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
