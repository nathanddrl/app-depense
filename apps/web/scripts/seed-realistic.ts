// Étale — seed réaliste de terrain (6 mois glissants) pour test utilisateur en
// boîte noire (Partie 2). Rejouable : `supabase db reset` (packages/db) repose
// le seed de dogfooding (comptes, foyer, template loyer), PUIS ce script ajoute
// la couche réaliste par-dessus en orchestrant les VRAIS domain-* (jamais
// d'insert SQL à la main pour la logique métier) — cohérent avec archi ch.1.4 :
// seul `apps/web` a le droit de composer `@app/db` + tous les `domain-*`.
//
// Usage : pnpm --filter @app/web seed:realistic (après `pnpm --filter @app/db db:reset`).
//
// Convention de dates : "aujourd'hui" est pris au sens propre (`new Date()`), pas
// une constante figée — le script reste rejouable à n'importe quelle date future,
// la fenêtre M-5..M0 glisse avec lui.

import { createDbClient } from "@app/db";
import {
  SupabaseExpenseRepository,
  SupabaseAidRepository,
  SupabaseSettlementRepository,
  SupabaseRecurringTemplateRepository,
} from "@app/db";
import { createExpense, getBalance, type ExpenseContext, type Category } from "@app/domain-expense";
import type { SettlementForBalance } from "@app/calc-engine";
import { addAid, type AidContext } from "@app/domain-aid";
import {
  createRecurringTemplate,
  updateRecurringTemplate,
  deactivateRecurringTemplate,
  runRecurringGeneration,
  type RecurrenceContext,
  type RecurringGenerationOutcome,
} from "@app/domain-recurrence";
import {
  initiateSettlement,
  confirmSettlement,
  cancelSettlement,
  type SettlementContext,
} from "@app/domain-settlement";

// Pas de fallback sur les clés demo Supabase CLI (`supabase status`) : un seed
// réaliste qui se rejoue silencieusement contre les mauvaises env vars (ou
// contre un projet Cloud si SUPABASE_URL est mal exporté) est un risque en
// dur — échec explicite plutôt qu'un fallback qui masque l'erreur.
const API_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!API_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Échec du seed réaliste : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies " +
      "(récupère-les avec `supabase status` après `pnpm --filter @app/db db:start`). " +
      "Aucun fallback sur les clés demo Supabase CLI.",
  );
  process.exit(1);
}

// ── Identités fixes du seed de dogfooding (packages/db/supabase/seed.sql) ────
const HOUSEHOLD_ID = "d0000000-0000-0000-0000-000000000001";
const NATHAN = "a0000000-0000-0000-0000-000000000001";
const OKSANA = "a0000000-0000-0000-0000-000000000002";
const LOYER_TEMPLATE_ID = "c0000000-0000-0000-0000-000000000001";

const supabase = createDbClient(API_URL, SERVICE_ROLE_KEY);

const expenseRepo = new SupabaseExpenseRepository(supabase);
const aidRepo = new SupabaseAidRepository(supabase);
const settlementRepo = new SupabaseSettlementRepository(supabase);
const recurringRepo = new SupabaseRecurringTemplateRepository(supabase);

const expenseCtx = (memberId: string): ExpenseContext => ({ memberId, householdId: HOUSEHOLD_ID });
const aidCtx = (memberId: string): AidContext => ({ memberId, householdId: HOUSEHOLD_ID });
const recurrenceCtx = (memberId: string): RecurrenceContext => ({
  memberId,
  householdId: HOUSEHOLD_ID,
});
const settlementCtx = (memberId: string): SettlementContext => ({
  memberId,
  householdId: HOUSEHOLD_ID,
});

const RATIO_5050 = [
  { memberId: NATHAN, pct: 50 },
  { memberId: OKSANA, pct: 50 },
];
const RATIO_7030 = [
  { memberId: NATHAN, pct: 70 },
  { memberId: OKSANA, pct: 30 },
];

type Result<T> = { ok: true; data: T; warnings?: unknown[] } | { ok: false; error: unknown };

function unwrap<T>(result: Result<T>, label: string): T {
  if (!result.ok) {
    throw new Error(`${label} a échoué : ${JSON.stringify(result.error)}`);
  }
  return result.data;
}

// Composition getBalance × listConfirmedSettlements (modèle ledger, D7/D15
// révisés) : même pattern que `apps/web/app/actions.ts` — seul l'app web a le
// droit de composer plusieurs domain-*.
async function currentBalance(memberId: string) {
  const confirmed = await settlementRepo.listConfirmedSettlements(HOUSEHOLD_ID);
  const settlements: SettlementForBalance[] = confirmed.map((s) => ({
    fromMemberId: s.fromMemberId,
    toMemberId: s.toMemberId,
    amountCents: s.amountCents,
    status: s.status,
  }));
  return unwrap(
    await getBalance(expenseRepo, expenseCtx(memberId), {
      householdId: HOUSEHOLD_ID,
      settlements,
    }),
    "getBalance",
  );
}

/** Décale la date "maintenant" à un jour donné d'un mois relatif à aujourd'hui. */
function relativeMonth(monthsAgo: number, day: number, hour = 12): Date {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, day, hour));
  return d;
}

/**
 * Dernier jour calendaire d'un mois relatif à aujourd'hui (ex. M-5 → 28 en
 * février). Utilisé comme "now" de génération pour garantir que TOUT
 * `day_of_month` (y compris 31, clampé D14) est bien atteint ce mois-là —
 * un jour fixe comme 20 sauterait silencieusement le template day=31 sur les
 * mois à 28/29/30 jours (`now.getUTCDate() < effectiveDay`).
 */
function lastDayOfRelativeMonth(monthsAgo: number): number {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo + 1, 0),
  ).getUTCDate();
}

/** `YYYY-MM-DD` pour une date calendaire, sans dérive de fuseau. */
function isoDate(monthsAgo: number, day: number): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() - monthsAgo;
  const d = new Date(Date.UTC(year, month, day));
  return d.toISOString().slice(0, 10);
}

async function generateMonth(
  monthsAgo: number,
  day: number,
): Promise<RecurringGenerationOutcome[]> {
  const now = relativeMonth(monthsAgo, day);
  const result = await runRecurringGeneration(recurringRepo, now);
  const summary = unwrap(result, "runRecurringGeneration");
  const period = now.toISOString().slice(0, 7);
  for (const r of summary.results) {
    console.log(`  [récurrence ${period}] ${r.templateId.slice(0, 8)}… → ${r.status}`);
  }
  return summary.results;
}

/** Retrouve l'`expenseId` de l'occurrence générée pour un template donné ce mois-là. */
function expenseIdForTemplate(results: RecurringGenerationOutcome[], templateId: string): string {
  const found = results.find((r) => r.templateId === templateId);
  if (!found || found.status !== "generated") {
    throw new Error(`Aucune occurrence générée pour le template ${templateId} ce mois-ci.`);
  }
  return found.expenseId;
}

async function createOneOff(opts: {
  monthsAgo: number;
  day: number;
  label: string;
  category: Category;
  grossCents: number;
  payerId: string;
  ratio?: { memberId: string; pct: number }[];
}): Promise<string> {
  const result = await createExpense(expenseRepo, expenseCtx(opts.payerId), {
    householdId: HOUSEHOLD_ID,
    label: opts.label,
    category: opts.category,
    grossCents: opts.grossCents,
    payerId: opts.payerId,
    incurredOn: isoDate(opts.monthsAgo, opts.day),
    shares: opts.ratio ?? RATIO_5050,
  });
  const expense = unwrap(result, `createExpense(${opts.label})`);
  return expense.id;
}

async function main(): Promise<void> {
  console.log("── Étale — seed réaliste (6 mois glissants) ──\n");

  // ── 1) Deux nouveaux templates récurrents (le loyer existe déjà, seed.sql) ──
  console.log("Création des templates récurrents additionnels…");

  const assurance = unwrap(
    await createRecurringTemplate(recurringRepo, recurrenceCtx(NATHAN), {
      householdId: HOUSEHOLD_ID,
      label: "Assurance habitation",
      category: "charges",
      amountCents: 4500,
      payerId: OKSANA,
      dayOfMonth: 10,
      shares: RATIO_5050,
    }),
    "createRecurringTemplate(assurance)",
  );

  const abonnement = unwrap(
    await createRecurringTemplate(recurringRepo, recurrenceCtx(NATHAN), {
      householdId: HOUSEHOLD_ID,
      label: "Abonnement salle de sport",
      category: "sorties",
      amountCents: 3000,
      payerId: NATHAN,
      dayOfMonth: 31, // clamp D14 : exposé sur tout mois < 31 jours de la fenêtre.
      shares: RATIO_5050,
    }),
    "createRecurringTemplate(abonnement day31)",
  );

  console.log(`  Assurance habitation: ${assurance.id}`);
  console.log(`  Abonnement (day=31): ${abonnement.id}\n`);

  // ── 2) M-5 (il y a 5 mois) ───────────────────────────────────────────────
  console.log("Mois M-5 : génération récurrence + dépenses ponctuelles…");
  await generateMonth(5, lastDayOfRelativeMonth(5));
  await createOneOff({
    monthsAgo: 5,
    day: 3,
    label: "Courses Carrefour",
    category: "courses",
    grossCents: 6237,
    payerId: NATHAN,
  });
  await createOneOff({
    monthsAgo: 5,
    day: 18,
    label: "Restaurant",
    category: "sorties",
    grossCents: 4500,
    payerId: OKSANA,
  });

  console.log("  Régularisation A — cycle complet confirmé sur M-5…");
  {
    const balance = await currentBalance(NATHAN);
    if (balance.amountCents > 0) {
      const settlement = unwrap(
        await initiateSettlement(settlementRepo, settlementCtx(balance.from), {
          householdId: HOUSEHOLD_ID,
          fromMemberId: balance.from,
          toMemberId: balance.to,
          amountCents: balance.amountCents,
          balanceAmountCents: balance.amountCents,
        }),
        "initiateSettlement A",
      );
      unwrap(
        await confirmSettlement(settlementRepo, settlementCtx(balance.to), {
          settlementId: settlement.id,
        }),
        "confirmSettlement A",
      );
      console.log(
        `  Settlement A confirmé (${settlement.amountCents / 100}€, ${balance.from.slice(0, 8)}…→${balance.to.slice(0, 8)}…) — ajustement ledger durable (modèle D7 révisé, plus de gel de dépenses).`,
      );
    } else {
      console.log("  Solde nul après M-5, pas de régularisation A possible (cas improbable).");
    }
  }
  console.log();

  // ── 3) M-4 ───────────────────────────────────────────────────────────────
  console.log("Mois M-4 : génération récurrence + dépenses ponctuelles…");
  await generateMonth(4, lastDayOfRelativeMonth(4));
  await createOneOff({
    monthsAgo: 4,
    day: 5,
    label: "Essence (transport)",
    category: "autre", // D18 : catégories figées, pas de "transport" dans l'enum.
    grossCents: 3820,
    payerId: NATHAN,
  });
  await createOneOff({
    monthsAgo: 4,
    day: 22,
    label: "Cadeau anniversaire (ratio custom 70/30)",
    category: "autre",
    grossCents: 1515, // centimes impairs → reliquat d'arrondi (D5).
    payerId: OKSANA,
    ratio: RATIO_7030,
  });

  console.log(
    "  Changement de montant de l'assurance (effectif seulement sur les occurrences futures, D13)…",
  );
  unwrap(
    await updateRecurringTemplate(recurringRepo, recurrenceCtx(NATHAN), {
      templateId: assurance.id,
      patch: { amountCents: 5200 },
    }),
    "updateRecurringTemplate(assurance)",
  );
  console.log();

  // ── 4) M-3 ───────────────────────────────────────────────────────────────
  console.log("Mois M-3 : génération récurrence + dépenses ponctuelles…");
  await generateMonth(3, lastDayOfRelativeMonth(3));
  await createOneOff({
    monthsAgo: 3,
    day: 2,
    label: "Courses Franprix",
    category: "courses",
    grossCents: 9107, // centimes impairs → reliquat d'arrondi (D5).
    payerId: NATHAN,
  });
  await createOneOff({
    monthsAgo: 3,
    day: 27,
    label: "Cinéma",
    category: "sorties",
    grossCents: 6000,
    payerId: OKSANA,
  });

  console.log("  Régularisation B — déclenchée puis annulée sur M-3/M-4…");
  {
    const balance = await currentBalance(NATHAN);
    if (balance.amountCents > 0) {
      const settlement = unwrap(
        await initiateSettlement(settlementRepo, settlementCtx(balance.from), {
          householdId: HOUSEHOLD_ID,
          fromMemberId: balance.from,
          toMemberId: balance.to,
          amountCents: balance.amountCents,
          balanceAmountCents: balance.amountCents,
        }),
        "initiateSettlement B",
      );
      unwrap(
        await cancelSettlement(settlementRepo, settlementCtx(balance.from), {
          settlementId: settlement.id,
        }),
        "cancelSettlement B",
      );
      console.log(
        `  Settlement B annulé (${settlement.amountCents / 100}€) — solde inchangé (modèle ledger, D7 révisé : aucune dépense n'a jamais été touchée).`,
      );
    } else {
      console.log("  Solde nul, pas de régularisation B possible (cas improbable).");
    }
  }
  console.log();

  // ── 5) M-2 ───────────────────────────────────────────────────────────────
  console.log("Mois M-2 : génération récurrence + dépenses ponctuelles…");
  await generateMonth(2, lastDayOfRelativeMonth(2));
  await createOneOff({
    monthsAgo: 2,
    day: 10,
    label: "Courses Lidl",
    category: "courses",
    grossCents: 7844,
    payerId: NATHAN,
  });
  await createOneOff({
    monthsAgo: 2,
    day: 19,
    label: "Métro / transports",
    category: "autre",
    grossCents: 2250,
    payerId: OKSANA,
  });

  console.log("  Désactivation de l'abonnement day=31 (ses occurrences s'arrêtent après ce mois)…");
  unwrap(
    await deactivateRecurringTemplate(recurringRepo, recurrenceCtx(NATHAN), {
      templateId: abonnement.id,
    }),
    "deactivateRecurringTemplate(abonnement)",
  );
  console.log();

  // ── 6) M-1 ───────────────────────────────────────────────────────────────
  console.log("Mois M-1 : génération récurrence + dépenses ponctuelles…");
  const resultsM1 = await generateMonth(1, lastDayOfRelativeMonth(1));
  await createOneOff({
    monthsAgo: 1,
    day: 6,
    label: "Pharmacie",
    category: "autre",
    grossCents: 3333, // centimes impairs → reliquat d'arrondi (D5).
    payerId: NATHAN,
  });
  await createOneOff({
    monthsAgo: 1,
    day: 25,
    label: "Bar",
    category: "sorties",
    grossCents: 5420,
    payerId: OKSANA,
  });

  console.log(
    "  Aide exceptionnelle sur le VRAI loyer de M-1 (cumulée à l'APL, dépasse la charge — warning D11)…",
  );
  {
    const rentExpenseId = expenseIdForTemplate(resultsM1, LOYER_TEMPLATE_ID);
    const aidResult = await addAid(aidRepo, aidCtx(NATHAN), {
      expenseId: rentExpenseId,
      label: "Aide exceptionnelle CAF",
      beneficiaryId: OKSANA,
      amountCents: 70000, // + APL 200€ déjà attachée au template = 900€ > 800€ de loyer.
    });
    unwrap(aidResult, "addAid (aide > charge, sur le vrai loyer M-1)");
    const warnings = aidResult.ok ? (aidResult.warnings ?? []) : [];
    console.log(`  → warnings: ${JSON.stringify(warnings)}, net attendu = 0€`);
  }
  console.log();

  // ── 7) M0 (aujourd'hui) ──────────────────────────────────────────────────
  console.log("Mois M0 (aujourd'hui) : génération récurrence + dépenses ponctuelles…");
  const resultsM0 = await generateMonth(0, new Date().getUTCDate());
  await createOneOff({
    monthsAgo: 0,
    day: Math.max(1, new Date().getUTCDate() - 3),
    label: "Courses de la semaine",
    category: "courses",
    grossCents: 4000,
    payerId: NATHAN,
  });

  console.log(
    "  Aide « les deux » sur le VRAI loyer de M0 (split 50/50, en plus de l'APL, D-produit 09/07)…",
  );
  {
    const rentExpenseId = expenseIdForTemplate(resultsM0, LOYER_TEMPLATE_ID);
    unwrap(
      await addAid(aidRepo, aidCtx(OKSANA), {
        expenseId: rentExpenseId,
        label: "Aide exceptionnelle (les deux, part 1/2)",
        beneficiaryId: NATHAN,
        amountCents: 10000,
      }),
      "addAid (les deux, part 1, sur le vrai loyer M0)",
    );
    unwrap(
      await addAid(aidRepo, aidCtx(OKSANA), {
        expenseId: rentExpenseId,
        label: "Aide exceptionnelle (les deux, part 2/2)",
        beneficiaryId: OKSANA,
        amountCents: 10000,
      }),
      "addAid (les deux, part 2, sur le vrai loyer M0)",
    );
  }
  console.log();

  // ── 8) Régularisation C — pending, non confirmée, au présent ─────────────
  console.log("Régularisation C — déclenchée maintenant, laissée PENDING…");
  const finalBalance = await currentBalance(NATHAN);
  if (finalBalance.amountCents === 0) {
    throw new Error(
      "Solde nul au présent — contraire à la contrainte du seed (le passage à zéro doit être provoqué manuellement en Partie 2). Ajuster les montants du seed.",
    );
  }
  const pendingSettlement = unwrap(
    await initiateSettlement(settlementRepo, settlementCtx(finalBalance.from), {
      householdId: HOUSEHOLD_ID,
      fromMemberId: finalBalance.from,
      toMemberId: finalBalance.to,
      amountCents: finalBalance.amountCents,
      balanceAmountCents: finalBalance.amountCents,
    }),
    "initiateSettlement C",
  );
  console.log(
    `  Settlement C pending : ${pendingSettlement.amountCents / 100}€, ${finalBalance.from.slice(0, 8)}…→${finalBalance.to.slice(0, 8)}…\n`,
  );

  // ── Résumé final ──────────────────────────────────────────────────────────
  await printSummary(finalBalance.amountCents, finalBalance.from, finalBalance.to);
}

async function printSummary(balanceCents: number, from: string, to: string): Promise<void> {
  console.log("── Résumé du seed ──────────────────────────────────────────");

  const { data: members } = await supabase.from("member").select("id, display_name");
  const nameOf = (id: string) => members?.find((m) => m.id === id)?.display_name ?? id;

  const { data: allExpenses } = await supabase
    .from("expense")
    .select("id, incurred_on, source, settlement_id, deleted_at")
    .eq("household_id", HOUSEHOLD_ID);

  const byMonth = new Map<string, number>();
  for (const e of allExpenses ?? []) {
    const month = e.incurred_on.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
  }

  console.log("\nComptes :");
  console.log("  nathan@etale.local / password-nathan");
  console.log("  copine@etale.local / password-copine");

  console.log("\nDépenses par mois (toutes sources confondues) :");
  for (const [month, count] of [...byMonth.entries()].sort()) {
    console.log(`  ${month} : ${count}`);
  }
  console.log(`  Total : ${allExpenses?.length ?? 0}`);

  const { data: templates } = await supabase
    .from("recurring_template")
    .select("id, label, amount_cents, day_of_month, active")
    .eq("household_id", HOUSEHOLD_ID);
  console.log("\nCharges récurrentes :");
  for (const t of templates ?? []) {
    console.log(
      `  ${t.label} — ${t.amount_cents / 100}€, jour ${t.day_of_month}, ${t.active ? "active" : "désactivée"}`,
    );
  }

  const { data: settlements } = await supabase
    .from("settlement")
    .select("id, status, amount_cents, initiated_at")
    .eq("household_id", HOUSEHOLD_ID)
    .order("initiated_at", { ascending: true });
  console.log("\nRégularisations :");
  for (const s of settlements ?? []) {
    console.log(`  ${s.status.padEnd(10)} — ${s.amount_cents / 100}€ (${s.initiated_at})`);
  }

  console.log(
    `\nSolde net actuel : ${nameOf(from)} doit ${(balanceCents / 100).toFixed(2)}€ à ${nameOf(to)} (régularisation pending en cours).`,
  );
  console.log("\n── Fin du seed réaliste ──");
}

main().catch((e) => {
  console.error("Échec du seed réaliste :", e);
  process.exit(1);
});
