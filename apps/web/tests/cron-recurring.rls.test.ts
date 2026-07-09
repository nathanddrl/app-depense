// Suite d'intégration gatée (même famille que `*.rls.test.ts`) — exerce le
// VRAI chemin `service_role` du cron (spec ch.5.4, T-C7.4) contre le Supabase
// local réel, pas des fakes.
//
// Précédent : `cron-recurring.test.ts` ne couvre que l'enveloppe HTTP avec un
// `RecurringTemplateRepository` fake injecté — il ne pouvait donc jamais
// détecter un problème de GRANT Postgres. C'est exactement ce trou qui a
// laissé passer le bug découvert le 09/07/2026 (T-CR3, decisions-techniques.md) :
// `service_role` a `rolbypassrls = true` (contourne la RLS) mais aucune
// migration ne lui accordait de privilège de table — deux systèmes
// d'autorisation Postgres distincts, l'un ne dispense pas de l'autre. Cette
// suite appelle le VRAI Route Handler (`GET`), avec le VRAI repository
// Supabase construit en `service_role`, contre la base locale réelle :
// `summary.failed` doit rester à 0 pour toute régression de ce type.
//
// Prérequis : `supabase start` + `supabase db reset` (seed = 1 template actif
// « Loyer », jour 5 — déjà passé pour la plupart des exécutions du mois).
// Lancé via `pnpm --filter @app/web test:rls`.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pkg from "pg";

const { Client } = pkg;

const API_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54521";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const CRON_SECRET = process.env.CRON_SECRET_TEST ?? "test-cron-secret-local-only";
const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54522/postgres";

// `route.ts` lit ces variables au moment de l'appel (pas à l'import), donc les
// fixer ici avant tout `it()` suffit — aucun besoin d'import dynamique.
process.env.NEXT_PUBLIC_SUPABASE_URL = API_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;
process.env.CRON_SECRET = CRON_SECRET;

const { GET } = await import("../app/api/cron/recurring/route");

function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

const client = new Client({ connectionString: DB_URL });
let generatedExpenseIds: string[] = [];

beforeAll(async () => {
  await client.connect();
});

afterAll(async () => {
  // Nettoyage ciblé : ne retire QUE ce que cette suite a pu générer (période
  // courante), jamais l'historique déjà là — même précaution que D13 ailleurs
  // dans le domaine (jamais toucher une occurrence préexistante).
  if (generatedExpenseIds.length > 0) {
    await client.query(`delete from recurring_occurrence where expense_id = any($1::uuid[])`, [
      generatedExpenseIds,
    ]);
    await client.query(`delete from expense_share where expense_id = any($1::uuid[])`, [
      generatedExpenseIds,
    ]);
    await client.query(`delete from aid where expense_id = any($1::uuid[])`, [
      generatedExpenseIds,
    ]);
    await client.query(`delete from expense where id = any($1::uuid[])`, [generatedExpenseIds]);
  }
  await client.end();
});

describe("cron récurrence — vrai chemin service_role (pas de fake)", () => {
  it("401 si le secret est absent/incorrect — jamais de génération sans auth", async () => {
    const res = await GET(new Request("http://test/api/cron/recurring"));
    expect(res.status).toBe(401);
  });

  it("génère sans erreur de permission contre la base réelle (GRANT ciblés, T-CR3-fix)", async () => {
    const res = await GET(
      new Request("http://test/api/cron/recurring", {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      }),
    );
    expect(res.status).toBe(200);

    const summary = (await res.json()) as { generated: number; skipped: number; failed: number };
    // L'assertion qui compte pour ce bug : 0 échec. `generated` vs `skipped`
    // dépend d'un run précédent (idempotence T-C7.2), les deux sont un succès.
    expect(summary.failed).toBe(0);
    expect(summary.generated + summary.skipped).toBeGreaterThan(0);

    const period = currentPeriod();
    const { rows } = await client.query<{ expense_id: string }>(
      `select expense_id from recurring_occurrence where period = $1`,
      [period],
    );
    expect(rows.length).toBeGreaterThan(0);
    generatedExpenseIds = rows.map((r) => r.expense_id);

    const { rows: expenseRows } = await client.query<{ source: string }>(
      `select source from expense where id = any($1::uuid[])`,
      [generatedExpenseIds],
    );
    expect(expenseRows.every((r) => r.source === "recurring")).toBe(true);
  });
});
