// @app/domain-recurrence — génération mensuelle des occurrences de templates
// récurrents (spec ch.5.4, T-C7.2). Aucune route cron ici (T-C7.4), aucune
// gestion du bord de mois (day_of_month invalide dans le mois, T-C7.3) : on
// suppose `day_of_month` valide dans le mois courant.
//
// Opération SYSTÈME (portée cron), pas d'`RecurrenceContext` : elle traite tous
// les foyers, jamais un scope RLS d'un seul foyer authentifié.
//
// Les parts figées sont calculées EXCLUSIVEMENT via `@app/calc-engine`
// (`computeExpense`, même fonction que `create_expense_with_shares`/`addAid`) —
// jamais recalculées à la main. Un échec sur un template (précondition calc-engine
// ou erreur repo) est capturé et n'interrompt jamais le traitement des autres
// templates (`failed`, pas de throw qui casserait le batch).

import { computeExpense, CalcPreconditionError } from "@app/calc-engine";
import { ok } from "@app/shared";
import type { ActionResult } from "@app/shared";
import type { RecurringTemplateRepository, TemplateForGeneration } from "./repository";

export type RecurringGenerationOutcome =
  | { templateId: string; status: "generated"; expenseId: string; occurrenceId: string }
  | { templateId: string; status: "skipped"; reason: "already-generated" | "day-not-reached" }
  | { templateId: string; status: "failed"; message: string };

export type RecurringGenerationSummary = { results: RecurringGenerationOutcome[] };

export async function runRecurringGeneration(
  repo: RecurringTemplateRepository,
  now: Date = new Date(),
): Promise<ActionResult<RecurringGenerationSummary>> {
  const period = firstOfMonth(now);
  const templates = await repo.listActiveTemplatesForGeneration();
  const results: RecurringGenerationOutcome[] = [];

  for (const template of templates) {
    results.push(await generateForTemplate(repo, template, period, now));
  }

  return ok({ results });
}

async function generateForTemplate(
  repo: RecurringTemplateRepository,
  template: TemplateForGeneration,
  period: string,
  now: Date,
): Promise<RecurringGenerationOutcome> {
  // Le jour du mois n'est pas encore atteint : rien à générer pour l'instant.
  if (now.getUTCDate() < template.dayOfMonth) {
    return { templateId: template.id, status: "skipped", reason: "day-not-reached" };
  }

  try {
    // Parts figées + aides via calc-engine (spec 4.1/4.3), jamais recalculées à la main.
    const computed = computeExpense({
      grossCents: template.amountCents,
      payerId: template.payerId,
      ratio: template.shares,
      aids: template.aids.map((a) => ({
        beneficiaryId: a.beneficiaryId,
        amountCents: a.amountCents,
      })),
    });

    const generated = await repo.generateOccurrence({
      templateId: template.id,
      period,
      householdId: template.householdId,
      label: template.label,
      category: template.category,
      amountCents: template.amountCents,
      payerId: template.payerId,
      incurredOn: incurredOnFor(period, template.dayOfMonth),
      shares: computed.shares.map((s) => ({
        memberId: s.memberId,
        cents: s.cents,
        pctSnapshot: s.pctSnapshot,
      })),
      aids: template.aids,
    });

    if (!generated) {
      return { templateId: template.id, status: "skipped", reason: "already-generated" };
    }
    return {
      templateId: template.id,
      status: "generated",
      expenseId: generated.expenseId,
      occurrenceId: generated.occurrenceId,
    };
  } catch (e) {
    const message =
      e instanceof CalcPreconditionError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Erreur inconnue lors de la génération.";
    return { templateId: template.id, status: "failed", message };
  }
}

/** `2026-07-14T...` → `"2026-07-01"` (UTC, aligné D4). */
function firstOfMonth(now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

/** `"2026-07-01"` + jour 5 → `"2026-07-05"` (day_of_month supposé valide, T-C7.3). */
function incurredOnFor(period: string, dayOfMonth: number): string {
  const [year, month] = period.split("-");
  return `${year}-${month}-${String(dayOfMonth).padStart(2, "0")}`;
}
