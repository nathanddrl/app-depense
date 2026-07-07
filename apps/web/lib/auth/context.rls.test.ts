import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pkg from "pg";
import { createDbClient, type DbClient } from "@app/db";
import { resolveContext } from "./resolve";

// Suite d'intégration GATÉE (spec ch.3.3, DA11) — même gate que la suite RLS de C2
// (`*.rls.test.ts` hors `pnpm test`). Prouve la DoD C2.5 :
//   1. le VRAI `resolveContext` résout le bon member + foyer pour les 2 comptes ;
//   2. le client obtenu par un VRAI signInWithPassword PORTE le JWT → la RLS
//      s'applique sur le vrai chemin (le compte voit son foyer, pas un autre) —
//      jamais de service_role.
//
// Prérequis : `supabase start` + `supabase db reset`, et l'URL/clé anon exposées
// (NEXT_PUBLIC_SUPABASE_* ou SUPABASE_*). Lancé via `pnpm --filter @app/web test:rls`.

const { Client } = pkg;

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54522/postgres";
const API_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54521";
// Clé anon locale par défaut (JWT secret de démo du CLI). Surchargée par l'env si
// ta stack en émet une autre (`supabase status`).
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE";

// Comptes du seed de dogfooding (D17).
const NATHAN = { email: "nathan@etale.local", password: "password-nathan", name: "Nathan" };
const OKSANA = { email: "copine@etale.local", password: "password-copine", name: "Oksana" };
const SEED_HOUSEHOLD = "d0000000-0000-0000-0000-000000000001";

// Foyer B ÉTRANGER (fixtures, préfixe f… pour un nettoyage ciblé) — Nathan/Oksana
// n'en sont pas membres : leur client authentifié ne doit voir aucune de ses lignes.
const HB = "fbbbbbbb-0000-0000-0000-00000000b0b0";
const UB = "fbbbbbbb-1111-0000-0000-00000000b0b0"; // auth user du foyer B
const MB = "fbbbbbbb-2222-0000-0000-00000000b0b0"; // member du foyer B
const EB = "fbbbbbbb-3333-0000-0000-00000000b0b0"; // dépense du foyer B

const pg = new Client({ connectionString: DB_URL });

const cleanupSql = `
  delete from expense    where id = '${EB}';
  delete from membership where household_id = '${HB}';
  delete from member     where id = '${MB}';
  delete from household  where id = '${HB}';
  delete from auth.users where id = '${UB}';
`;

const fixturesSql = `
  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000','${UB}','authenticated','authenticated',
    'bob-c25@b.local', now(), now(), '{}', '{}');

  insert into member (id, auth_user_id, display_name) values ('${MB}','${UB}','Bob C25');

  insert into household (id, name) values ('${HB}','Foyer B C25');

  insert into membership (household_id, member_id, default_share_pct, role) values
    ('${HB}','${MB}',100,'admin');

  insert into expense (id, household_id, label, category, gross_amount_cents, payer_member_id, incurred_on, created_by)
  values ('${EB}','${HB}','Loyer B','loyer',70000,'${MB}','2026-07-01','${MB}');
`;

/** Client Supabase authentifié par un VRAI signInWithPassword (porte le JWT). */
async function signIn(email: string, password: string): Promise<DbClient> {
  const supabase = createDbClient(API_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signInWithPassword(${email}) a échoué : ${error.message}`);
  return supabase;
}

let nathan: DbClient;
let oksana: DbClient;

beforeAll(async () => {
  await pg.connect();
  await pg.query(cleanupSql);
  await pg.query(fixturesSql);
  nathan = await signIn(NATHAN.email, NATHAN.password);
  oksana = await signIn(OKSANA.email, OKSANA.password);
});

afterAll(async () => {
  await pg.query(cleanupSql);
  await pg.end();
});

describe("getCurrentContext — résolution du member + foyer (les 2 comptes)", () => {
  it("Nathan → member 'Nathan' + son foyer", async () => {
    const ctx = await resolveContext(nathan);
    expect(ctx).not.toBeNull();
    expect(ctx?.member.displayName).toBe(NATHAN.name);
    expect(ctx?.householdId).toBe(SEED_HOUSEHOLD);
  });

  it("Oksana → member 'Oksana' + le même foyer", async () => {
    const ctx = await resolveContext(oksana);
    expect(ctx).not.toBeNull();
    expect(ctx?.member.displayName).toBe(OKSANA.name);
    expect(ctx?.householdId).toBe(SEED_HOUSEHOLD);
  });
});

describe("RLS sur le vrai chemin (JWT utilisateur, pas service_role)", () => {
  it("Nathan voit les données de SON foyer", async () => {
    const household = await nathan.from("household").select("id").eq("id", SEED_HOUSEHOLD);
    expect(household.error).toBeNull();
    expect(household.data).toHaveLength(1);

    const templates = await nathan.from("recurring_template").select("id");
    expect(templates.error).toBeNull();
    expect((templates.data ?? []).length).toBeGreaterThan(0);
  });

  it("Nathan ne voit AUCUNE donnée du foyer B", async () => {
    const household = await nathan.from("household").select("id").eq("id", HB);
    expect(household.error).toBeNull();
    expect(household.data).toHaveLength(0);

    const expense = await nathan.from("expense").select("id").eq("id", EB);
    expect(expense.error).toBeNull();
    expect(expense.data).toHaveLength(0);
  });

  it("Oksana non plus ne voit le foyer B", async () => {
    const household = await oksana.from("household").select("id").eq("id", HB);
    expect(household.error).toBeNull();
    expect(household.data).toHaveLength(0);
  });
});
