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

/** Une part figée à persister (sortie calc-engine, aligné `expense_share`). */
export type RecurringShareDTO = { memberId: string; cents: number; pctSnapshot: number };

/**
 * Vue d'un template actif nécessaire à la génération (portée cron, T-C7.2) :
 * tous foyers confondus, pas de scope RLS par foyer unique ici.
 */
export type TemplateForGeneration = {
  id: string;
  householdId: string;
  label: string;
  category: Category;
  amountCents: number;
  payerId: string;
  dayOfMonth: number;
  shares: ShareConfigInput[];
  aids: NewRecurringAid[];
};

/** Entrée de génération d'une occurrence (parts déjà figées par calc-engine). */
export type GenerateOccurrenceInput = {
  templateId: string;
  period: string; // 1er du mois généré, `YYYY-MM-01`
  householdId: string;
  label: string;
  category: Category;
  amountCents: number;
  payerId: string;
  incurredOn: string; // date réelle de la charge (période + jour du mois)
  shares: RecurringShareDTO[];
  aids: NewRecurringAid[];
};

/** Résultat d'une génération réussie (`null` si déjà générée, idempotence). */
export type GeneratedOccurrence = { occurrenceId: string; expenseId: string };

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

  /** Templates actifs, tous foyers confondus (portée cron, T-C7.2). */
  listActiveTemplatesForGeneration(): Promise<TemplateForGeneration[]>;

  /** Templates actifs d'un foyer donné, pour la liste UI (T-CR2). */
  listRecurringTemplatesForHousehold(householdId: string): Promise<RecurringTemplate[]>;

  /**
   * Génère l'occurrence (dépense + parts + aides + `recurring_occurrence`) pour
   * ce template/période si elle n'existe pas déjà. L'idempotence est garantie par
   * la contrainte unique `(template_id, period)` côté DB, jamais par une
   * vérification applicative : `null` en retour = déjà générée (no-op silencieux).
   */
  generateOccurrence(input: GenerateOccurrenceInput): Promise<GeneratedOccurrence | null>;
}
