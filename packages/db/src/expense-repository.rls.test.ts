import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pkg from "pg";
import { createClient } from "@supabase/supabase-js";
import { SupabaseExpenseRepository } from "./expense-repository";
import type { Database } from "./database.types";

const { Client } = pkg;

// Test d'intégration gaté (Docker/Supabase local requis, `pnpm test:rls`) : exerce
// SupabaseExpenseRepository lui-même via un VRAI client authentifié (login réel par
// signInWithPassword, pas une impersonation `set_config` comme dans rls.rls.test.ts),
// pour prouver que le chemin utilisateur complet (repo TS → RPC → RLS Postgres)
// fonctionne de bout en bout, pas seulement la policy SQL brute (déjà couverte).
//
// Fixtures dédiées (préfixe e…), distinctes du seed de dogfooding et des fixtures
// f… de rls.rls.test.ts, pour ne collisionner avec ni l'un ni l'autre.

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54522/postgres";
const API_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54521";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const HA = "e0000000-0000-0000-0000-0000000000aa"; // foyer A
const HB = "e0000000-0000-0000-0000-0000000000bb"; // foyer B
const UA1 = "e1000000-0000-0000-0000-0000000000a1"; // auth user Alice (A)
const UA2 = "e1000000-0000-0000-0000-0000000000a2"; // auth user Amir  (A)
const UB1 = "e1000000-0000-0000-0000-0000000000b1"; // auth user Bob   (B)
const MA1 = "e2000000-0000-0000-0000-0000000000a1"; // member Alice
const MA2 = "e2000000-0000-0000-0000-0000000000a2"; // member Amir
const MB1 = "e2000000-0000-0000-0000-0000000000b1"; // member Bob

const client = new Client({ connectionString: DB_URL });

const cleanupSql = `
  delete from expense_share  where expense_id in (select id from expense where household_id in ('${HA}','${HB}'));
  delete from expense        where household_id in ('${HA}','${HB}');
  delete from membership     where household_id in ('${HA}','${HB}');
  delete from household      where id in ('${HA}','${HB}');
  delete from member         where id in ('${MA1}','${MA2}','${MB1}');
  delete from auth.identities where user_id in ('${UA1}','${UA2}','${UB1}');
  delete from auth.users     where id in ('${UA1}','${UA2}','${UB1}');
`;

const authUser = (id: string, email: string, password: string) => `
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000','${id}','authenticated','authenticated',
    '${email}', extensions.crypt('${password}', extensions.gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}',
    '', '', '', '', '', '', '', '');
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values ('${id}', '${id}', '{"sub":"${id}","email":"${email}"}', 'email', now(), now(), now());
`;

const PASSWORD = "password-test-expense-repo";

const fixturesSql = `
  ${authUser(UA1, "alice@e-a.local", PASSWORD)}
  ${authUser(UA2, "amir@e-a.local", PASSWORD)}
  ${authUser(UB1, "bob@e-b.local", PASSWORD)}

  insert into member (id, auth_user_id, display_name) values
    ('${MA1}','${UA1}','Alice'), ('${MA2}','${UA2}','Amir'), ('${MB1}','${UB1}','Bob');

  insert into household (id, name) values ('${HA}','Foyer A'), ('${HB}','Foyer B');

  insert into membership (household_id, member_id, default_share_pct, role) values
    ('${HA}','${MA1}',50,'admin'), ('${HA}','${MA2}',50,'member'),
    ('${HB}','${MB1}',100,'admin');
`;

async function signIn(email: string) {
  const supabase = createClient<Database>(API_URL, ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return supabase;
}

beforeAll(async () => {
  await client.connect();
  await client.query(cleanupSql);
  await client.query(fixturesSql);
}, 30000);

afterAll(async () => {
  await client.query(cleanupSql);
  await client.end();
});

describe("SupabaseExpenseRepository — insertion réelle via JWT utilisateur (chemin d'appli complet)", () => {
  it("Alice insère un loyer 800€ 50/50 → parts figées 40000/40000 en relecture", async () => {
    const supabase = await signIn("alice@e-a.local");
    const repo = new SupabaseExpenseRepository(supabase);

    const expense = await repo.insertExpenseWithShares(
      {
        householdId: HA,
        label: "Loyer",
        category: "loyer",
        grossCents: 80000,
        payerId: MA1,
        incurredOn: "2026-07-01",
        source: "manual",
        createdBy: MA1,
      },
      [
        { memberId: MA1, cents: 40000, pctSnapshot: 50 },
        { memberId: MA2, cents: 40000, pctSnapshot: 50 },
      ],
    );

    expect(expense.grossCents).toBe(80000);
    const byMember = Object.fromEntries(expense.shares.map((s) => [s.memberId, s.cents]));
    expect(byMember[MA1]).toBe(40000);
    expect(byMember[MA2]).toBe(40000);

    const reread = await repo.getExpenseById(expense.id);
    expect(reread?.shares).toHaveLength(2);
  });

  it("getHouseholdMemberIds renvoie les 2 membres du foyer A pour Alice", async () => {
    const supabase = await signIn("alice@e-a.local");
    const repo = new SupabaseExpenseRepository(supabase);
    const ids = await repo.getHouseholdMemberIds(HA);
    expect(new Set(ids)).toEqual(new Set([MA1, MA2]));
  });

  it("Bob (foyer B) ne voit AUCUNE dépense du foyer A via listExpenses", async () => {
    const alice = new SupabaseExpenseRepository(await signIn("alice@e-a.local"));
    await alice.insertExpenseWithShares(
      {
        householdId: HA,
        label: "Courses",
        category: "courses",
        grossCents: 5000,
        payerId: MA1,
        incurredOn: "2026-07-02",
        source: "manual",
        createdBy: MA1,
      },
      [{ memberId: MA1, cents: 5000, pctSnapshot: 100 }],
    );

    const bob = new SupabaseExpenseRepository(await signIn("bob@e-b.local"));
    const bobsView = await bob.listExpenses(HA, {});
    expect(bobsView).toEqual([]);
  });

  it("Bob ne peut pas insérer une dépense dans le foyer A (RLS via le RPC)", async () => {
    const bob = new SupabaseExpenseRepository(await signIn("bob@e-b.local"));
    await expect(
      bob.insertExpenseWithShares(
        {
          householdId: HA,
          label: "pirate",
          category: "autre",
          grossCents: 100,
          payerId: MB1,
          incurredOn: "2026-07-01",
          source: "manual",
          createdBy: MB1,
        },
        [{ memberId: MB1, cents: 100, pctSnapshot: 100 }],
      ),
    ).rejects.toThrow();
  });
});
