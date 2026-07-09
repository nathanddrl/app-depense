// SupabaseRecurringTemplateRepository — implémentation concrète du port
// `RecurringTemplateRepository` défini par `@app/domain-recurrence` (archi ch.1.4
// / DA4, spec ch.5.4, T-C7.1/T-C7.2).
//
// `generateOccurrence` passe par la RPC `generate_recurring_occurrence`
// (atomique, même précédent que `create_expense_with_shares`) : dépense +
// parts + aides + `recurring_occurrence` en une seule transaction. L'idempotence
// est garantie par la contrainte unique `(template_id, period)` côté DB — un
// retour `null` signale une génération déjà effectuée pour cette période
// (no-op silencieux, pas une erreur).
//
// `db` reste une couche feuille (garde ESLint `no-restricted-imports` sur
// `@app/domain-*`) : ce fichier n'importe RIEN de `@app/domain-recurrence`, pas
// même le type du port. Les types ci-dessous ont les mêmes noms de champs que le
// port (voir `packages/domain-recurrence/src/repository.ts`) mais sont dérivés ici
// de la connaissance que `db` a déjà de son propre schéma — deux vues (snake_case
// DB / camelCase domaine) du même schéma, comme `expense-repository.ts`.
//
// Même précédent que `updateExpenseWithShares`/`addAid` (pas de RPC atomique) :
// insert du `recurring_template` puis insert des `recurring_aid`, en 2 appels —
// pas de contrainte inter-tables qui exigerait une transaction, et le coût d'un
// échec partiel (template créé sans ses aides) est acceptable car recréable via
// `updateRecurringTemplate`/retry côté UI (à documenter côté future Server Action).

import type { DbClient } from "./client";
import type { Json, Tables, TablesUpdate } from "./index";

export type Category = Tables<"recurring_template">["category"];
export type ShareConfigInput = { memberId: string; pct: number };

export type NewRecurringTemplate = {
  householdId: string;
  label: string;
  category: Category;
  amountCents: number;
  payerId: string;
  dayOfMonth: number;
  shares: ShareConfigInput[];
};

export type NewRecurringAid = { beneficiaryId: string; label: string; amountCents: number };

export type RecurringTemplateScalarPatch = Partial<{
  label: string;
  category: Category;
  amountCents: number;
  payerId: string;
  dayOfMonth: number;
  shares: ShareConfigInput[];
}>;

export type RecurringAidDTO = {
  id: string;
  beneficiaryId: string;
  label: string;
  amountCents: number;
};

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

export type StoredRecurringTemplate = RecurringTemplate;

/** Une part figée à persister (sortie calc-engine, aligné `expense_share`). */
export type RecurringShareDTO = { memberId: string; cents: number; pctSnapshot: number };

/** Vue d'un template actif pour la génération (portée cron, T-C7.2, tous foyers). */
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

export type GenerateOccurrenceInput = {
  templateId: string;
  period: string;
  householdId: string;
  label: string;
  category: Category;
  amountCents: number;
  payerId: string;
  incurredOn: string;
  shares: RecurringShareDTO[];
  aids: NewRecurringAid[];
};

export type GeneratedOccurrence = { occurrenceId: string; expenseId: string };

type RecurringTemplateRow = Tables<"recurring_template">;
type RecurringAidRow = Tables<"recurring_aid">;

// `shares_config` est stocké en snake_case (spec ch.3.2 : `[{member_id, pct}]`,
// même format que `seed.sql`) — jamais un cast direct camelCase↔JSON, qui
// désynchronise silencieusement lecture et écriture (memberId `undefined` au
// retour, cassant `computeExpense`/l'affichage dès que la donnée vient d'ailleurs
// que du chemin d'écriture applicatif, ex. seed SQL).
function toShares(sharesConfig: Json): ShareConfigInput[] {
  const raw = (sharesConfig as unknown as { member_id: string; pct: number }[]) ?? [];
  return raw.map((s) => ({ memberId: s.member_id, pct: s.pct }));
}

function fromShares(shares: ShareConfigInput[]): Json {
  return shares.map((s) => ({ member_id: s.memberId, pct: s.pct })) as unknown as Json;
}

function toRecurringAidDTO(row: RecurringAidRow): RecurringAidDTO {
  return {
    id: row.id,
    beneficiaryId: row.beneficiary_member_id,
    label: row.label,
    amountCents: row.amount_cents,
  };
}

function toRecurringTemplate(
  row: RecurringTemplateRow,
  aidRows: RecurringAidRow[],
): RecurringTemplate {
  return {
    id: row.id,
    householdId: row.household_id,
    label: row.label,
    category: row.category,
    amountCents: row.amount_cents,
    payerId: row.payer_member_id,
    dayOfMonth: row.day_of_month,
    shares: toShares(row.shares_config),
    active: row.active,
    createdAt: row.created_at,
    aids: aidRows.map(toRecurringAidDTO),
  };
}

export class SupabaseRecurringTemplateRepository {
  constructor(private readonly supabase: DbClient) {}

  async getHouseholdMemberIds(householdId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from("membership")
      .select("member_id")
      .eq("household_id", householdId);
    if (error) throw error;
    return (data ?? []).map((m) => m.member_id);
  }

  async createRecurringTemplateWithAids(
    template: NewRecurringTemplate,
    aids: NewRecurringAid[],
  ): Promise<RecurringTemplate> {
    const { data: templateRow, error: insertError } = await this.supabase
      .from("recurring_template")
      .insert({
        household_id: template.householdId,
        label: template.label,
        category: template.category,
        amount_cents: template.amountCents,
        payer_member_id: template.payerId,
        day_of_month: template.dayOfMonth,
        shares_config: fromShares(template.shares),
      })
      .select()
      .single();
    if (insertError) throw insertError;

    if (aids.length > 0) {
      const { error: aidsError } = await this.supabase.from("recurring_aid").insert(
        aids.map((a) => ({
          template_id: templateRow.id,
          beneficiary_member_id: a.beneficiaryId,
          label: a.label,
          amount_cents: a.amountCents,
        })),
      );
      if (aidsError) throw aidsError;
    }

    return this.getRecurringTemplateOrThrow(templateRow.id);
  }

  async getRecurringTemplateById(templateId: string): Promise<StoredRecurringTemplate | null> {
    const { data: templateRow, error } = await this.supabase
      .from("recurring_template")
      .select("*")
      .eq("id", templateId)
      .maybeSingle();
    if (error) throw error;
    if (!templateRow) return null;

    const { data: aidRows, error: aidsError } = await this.supabase
      .from("recurring_aid")
      .select("*")
      .eq("template_id", templateId);
    if (aidsError) throw aidsError;

    return toRecurringTemplate(templateRow, aidRows ?? []);
  }

  async updateRecurringTemplate(
    templateId: string,
    patch: RecurringTemplateScalarPatch,
  ): Promise<RecurringTemplate> {
    const scalarUpdate: TablesUpdate<"recurring_template"> = {};
    if (patch.label !== undefined) scalarUpdate.label = patch.label;
    if (patch.category !== undefined) scalarUpdate.category = patch.category;
    if (patch.amountCents !== undefined) scalarUpdate.amount_cents = patch.amountCents;
    if (patch.payerId !== undefined) scalarUpdate.payer_member_id = patch.payerId;
    if (patch.dayOfMonth !== undefined) scalarUpdate.day_of_month = patch.dayOfMonth;
    if (patch.shares !== undefined) scalarUpdate.shares_config = fromShares(patch.shares);

    if (Object.keys(scalarUpdate).length > 0) {
      const { error } = await this.supabase
        .from("recurring_template")
        .update(scalarUpdate)
        .eq("id", templateId);
      if (error) throw error;
    }

    return this.getRecurringTemplateOrThrow(templateId);
  }

  async deactivateRecurringTemplate(templateId: string): Promise<{ id: string; active: false }> {
    const { data, error } = await this.supabase
      .from("recurring_template")
      .update({ active: false })
      .eq("id", templateId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Modèle récurrent introuvable juste avant désactivation.");
    return { id: data.id, active: false };
  }

  async listActiveTemplatesForGeneration(): Promise<TemplateForGeneration[]> {
    const { data: templateRows, error } = await this.supabase
      .from("recurring_template")
      .select("*")
      .eq("active", true);
    if (error) throw error;
    if (!templateRows || templateRows.length === 0) return [];

    const ids = templateRows.map((t) => t.id);
    const { data: aidRows, error: aidsError } = await this.supabase
      .from("recurring_aid")
      .select("*")
      .in("template_id", ids);
    if (aidsError) throw aidsError;

    const aidsByTemplate = new Map<string, RecurringAidRow[]>();
    for (const row of aidRows ?? []) {
      const list = aidsByTemplate.get(row.template_id) ?? [];
      list.push(row);
      aidsByTemplate.set(row.template_id, list);
    }

    return templateRows.map((row) => ({
      id: row.id,
      householdId: row.household_id,
      label: row.label,
      category: row.category,
      amountCents: row.amount_cents,
      payerId: row.payer_member_id,
      dayOfMonth: row.day_of_month,
      shares: toShares(row.shares_config),
      aids: (aidsByTemplate.get(row.id) ?? []).map((a) => ({
        beneficiaryId: a.beneficiary_member_id,
        label: a.label,
        amountCents: a.amount_cents,
      })),
    }));
  }

  async listRecurringTemplatesForHousehold(householdId: string): Promise<RecurringTemplate[]> {
    const { data: templateRows, error } = await this.supabase
      .from("recurring_template")
      .select("*")
      .eq("household_id", householdId)
      .eq("active", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!templateRows || templateRows.length === 0) return [];

    const ids = templateRows.map((t) => t.id);
    const { data: aidRows, error: aidsError } = await this.supabase
      .from("recurring_aid")
      .select("*")
      .in("template_id", ids);
    if (aidsError) throw aidsError;

    const aidsByTemplate = new Map<string, RecurringAidRow[]>();
    for (const row of aidRows ?? []) {
      const list = aidsByTemplate.get(row.template_id) ?? [];
      list.push(row);
      aidsByTemplate.set(row.template_id, list);
    }

    return templateRows.map((row) => toRecurringTemplate(row, aidsByTemplate.get(row.id) ?? []));
  }

  async generateOccurrence(input: GenerateOccurrenceInput): Promise<GeneratedOccurrence | null> {
    const { data, error } = await this.supabase.rpc("generate_recurring_occurrence", {
      p_template_id: input.templateId,
      p_period: input.period,
      p_household_id: input.householdId,
      p_label: input.label,
      p_category: input.category,
      p_gross_amount_cents: input.amountCents,
      p_payer_member_id: input.payerId,
      p_incurred_on: input.incurredOn,
      p_shares: input.shares.map((s) => ({
        member_id: s.memberId,
        cents: s.cents,
        pct_snapshot: s.pctSnapshot,
      })),
      p_aids: input.aids.map((a) => ({
        beneficiary_member_id: a.beneficiaryId,
        label: a.label,
        amount_cents: a.amountCents,
      })),
    });
    if (error) throw error;
    if (!data) return null;

    const result = data as { occurrence_id: string; expense_id: string };
    return { occurrenceId: result.occurrence_id, expenseId: result.expense_id };
  }

  private async getRecurringTemplateOrThrow(templateId: string): Promise<RecurringTemplate> {
    const template = await this.getRecurringTemplateById(templateId);
    if (!template) throw new Error("Modèle récurrent introuvable juste après écriture.");
    return template;
  }
}
