// @app/domain-recurrence — PORT de persistance (inversion de dépendance).
//
// Le domaine définit l'interface dont il a besoin ; il ne connaît ni Supabase ni
// les cookies. L'implémentation concrète `SupabaseRecurringTemplateRepository` vit
// dans `@app/db` et satisfait ce port STRUCTURELLEMENT (typage structurel TS, sans
// `implements` ni import de domain-*) — `@app/db` reste une feuille. Les tests
// injectent un fake en mémoire. Toutes les opérations sont déjà scopées au foyer
// courant (le repo porte le client authentifié → la RLS s'applique au runtime).

import type { Category, RecurringTemplate, ShareConfigInput } from "./types";

/** Champs scalaires d'un template à insérer (les aides sont passées à part). */
export type NewRecurringTemplate = {
  householdId: string;
  label: string;
  category: Category;
  amountCents: number;
  payerId: string;
  dayOfMonth: number;
  shares: ShareConfigInput[];
};

/** Champs scalaires d'une aide récurrente à insérer. */
export type NewRecurringAid = { beneficiaryId: string; label: string; amountCents: number };

/** Patch scalaire d'édition (aucun champ = inchangé). */
export type RecurringTemplateScalarPatch = Partial<{
  label: string;
  category: Category;
  amountCents: number;
  payerId: string;
  dayOfMonth: number;
  shares: ShareConfigInput[];
}>;

/** Vue de lecture d'un template stocké (scope foyer déjà appliqué par la RLS). */
export type StoredRecurringTemplate = RecurringTemplate;

export interface RecurringTemplateRepository {
  /** Ids des membres du foyer (validation contextuelle : payeur/parts/aides ∈ foyer). */
  getHouseholdMemberIds(householdId: string): Promise<string[]>;

  /** Insertion du template + des aides récurrentes (l'impl @app/db documente l'atomicité). */
  createRecurringTemplateWithAids(
    template: NewRecurringTemplate,
    aids: NewRecurringAid[],
  ): Promise<RecurringTemplate>;

  /** Lecture d'un template pour édition/désactivation (null si absent/hors périmètre RLS). */
  getRecurringTemplateById(templateId: string): Promise<StoredRecurringTemplate | null>;

  /** Réécriture des champs scalaires fournis (patch minimal). */
  updateRecurringTemplate(
    templateId: string,
    patch: RecurringTemplateScalarPatch,
  ): Promise<RecurringTemplate>;

  /** Désactivation (`active = false`), jamais de suppression (l'historique reste intact). */
  deactivateRecurringTemplate(templateId: string): Promise<{ id: string; active: false }>;
}
