// @app/domain-recurrence — DTOs et entrées du domaine « template récurrent »
// (spec ch.5.4, T-C7.1). Types de contour, sérialisables. La catégorie réutilise
// l'enum de la DB (D18) via un import de TYPE uniquement (domain→db autorisé,
// aucun runtime db ici).

import type { Enums } from "@app/db";

/** Catégorie figée (enum DB, D18) : 'loyer'|'courses'|'charges'|'sorties'|'autre'. */
export type Category = Enums<"expense_category">;

/**
 * Identité résolue par le seam `getCurrentContext()` et injectée par `actions.ts`.
 * Le domaine ne touche jamais aux cookies/session : il reçoit l'acteur
 * (`memberId`) et le foyer courant (scope autoritaire, jamais fourni par le client).
 */
export type RecurrenceContext = { memberId: string; householdId: string };

/** Une ligne de répartition en % déclarée sur le template (aligné `validateRatio`). */
export type ShareConfigInput = { memberId: string; pct: number };

/** Entrée de création d'une aide récurrente adossée au template. */
export type NewRecurringAidInput = {
  beneficiaryId: string;
  label: string;
  amountCents: number;
};

/** Entrée de création d'un template récurrent (spec ch.5.4). */
export type CreateRecurringTemplateInput = {
  householdId: string;
  label: string;
  category: Category;
  amountCents: number;
  payerId: string;
  dayOfMonth: number;
  shares: ShareConfigInput[];
  aids?: NewRecurringAidInput[];
};

/** Patch d'édition. Tout champ absent = inchangé. Le foyer n'est pas déplaçable. */
export type UpdateRecurringTemplateInput = {
  templateId: string;
  patch: Partial<Omit<CreateRecurringTemplateInput, "householdId" | "aids">>;
};

export type DeactivateRecurringTemplateInput = { templateId: string };

/** Une aide récurrente rattachée à un template (une ligne de la table `recurring_aid`). */
export type RecurringAidDTO = {
  id: string;
  beneficiaryId: string;
  label: string;
  amountCents: number;
};

/** Template récurrent tel que restitué par le domaine. */
export type RecurringTemplate = {
  id: string;
  householdId: string;
  label: string;
  category: Category;
  amountCents: number;
  payerId: string;
  dayOfMonth: number;
  shares: ShareConfigInput[];
  active: boolean;
  createdAt: string;
  aids: RecurringAidDTO[];
};
