import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pkg from "pg";

const { Client } = pkg;

// Suite d'intégration RLS (spec-technique ch.3.3, DA11 priorité 1).
// Vérifie l'isolation par foyer : un membre d'un autre foyer ne peut NI lire NI
// écrire (SELECT/INSERT/UPDATE/DELETE) les données d'un foyer dont il n'est pas
// membre — tables PARENTS et ENFANTS. Impersonation via JWT claims + rôle
// `authenticated`. Fixtures posées en superuser (BYPASSRLS) puis rollback.
//
// Prérequis : `supabase start` + `supabase db reset`. Lancé via `pnpm test:rls`.

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54522/postgres";

// ── UUIDs de fixtures (préfixes f… pour un nettoyage ciblé) ──────────────────
const HA = "f0000000-0000-0000-0000-0000000000aa"; // foyer A
const HB = "f0000000-0000-0000-0000-0000000000bb"; // foyer B
const UA1 = "f1000000-0000-0000-0000-0000000000a1"; // auth user Alice (A)
const UA2 = "f1000000-0000-0000-0000-0000000000a2"; // auth user Amir  (A)
const UB1 = "f1000000-0000-0000-0000-0000000000b1"; // auth user Bob   (B)
const MA1 = "f2000000-0000-0000-0000-0000000000a1"; // member Alice
const MA2 = "f2000000-0000-0000-0000-0000000000a2"; // member Amir
const MB1 = "f2000000-0000-0000-0000-0000000000b1"; // member Bob
const EA = "f3000000-0000-0000-0000-0000000000aa";
const EB = "f3000000-0000-0000-0000-0000000000bb";
const SHA = "f4000000-0000-0000-0000-0000000000aa";
const SHB = "f4000000-0000-0000-0000-0000000000bb";
const AIDA = "f5000000-0000-0000-0000-0000000000aa";
const AIDB = "f5000000-0000-0000-0000-0000000000bb";
const STA = "f6000000-0000-0000-0000-0000000000aa";
const STB = "f6000000-0000-0000-0000-0000000000bb";
const TA = "f7000000-0000-0000-0000-0000000000aa";
const TB = "f7000000-0000-0000-0000-0000000000bb";
const RAA = "f8000000-0000-0000-0000-0000000000aa";
const RAB = "f8000000-0000-0000-0000-0000000000bb";
const OCA = "f9000000-0000-0000-0000-0000000000aa";
const OCB = "f9000000-0000-0000-0000-0000000000bb";

const client = new Client({ connectionString: DB_URL });

const cleanupSql = `
  delete from recurring_occurrence where template_id in ('${TA}','${TB}');
  delete from recurring_aid       where template_id in ('${TA}','${TB}');
  delete from recurring_template  where id in ('${TA}','${TB}');
  delete from aid                 where expense_id in ('${EA}','${EB}');
  delete from expense_share       where expense_id in ('${EA}','${EB}');
  delete from expense             where id in ('${EA}','${EB}');
  delete from settlement          where id in ('${STA}','${STB}');
  delete from membership          where household_id in ('${HA}','${HB}');
  delete from member              where id in ('${MA1}','${MA2}','${MB1}');
  delete from household           where id in ('${HA}','${HB}');
  delete from auth.users          where id in ('${UA1}','${UA2}','${UB1}');
`;

const authUser = (id: string, email: string) => `
  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000','${id}','authenticated','authenticated',
    '${email}', now(), now(), '{}', '{}');`;

const fixturesSql = `
  ${authUser(UA1, "alice@a.local")}
  ${authUser(UA2, "amir@a.local")}
  ${authUser(UB1, "bob@b.local")}

  insert into member (id, auth_user_id, display_name) values
    ('${MA1}','${UA1}','Alice'), ('${MA2}','${UA2}','Amir'), ('${MB1}','${UB1}','Bob');

  insert into household (id, name) values ('${HA}','Foyer A'), ('${HB}','Foyer B');

  insert into membership (household_id, member_id, default_share_pct, role) values
    ('${HA}','${MA1}',50,'admin'), ('${HA}','${MA2}',50,'member'),
    ('${HB}','${MB1}',100,'admin');

  insert into settlement (id, household_id, amount_cents, from_member_id, to_member_id, initiated_by) values
    ('${STA}','${HA}',30000,'${MA2}','${MA1}','${MA2}'),
    ('${STB}','${HB}',5000,'${MB1}','${MB1}','${MB1}');

  insert into expense (id, household_id, label, category, gross_amount_cents, payer_member_id, incurred_on, created_by) values
    ('${EA}','${HA}','Loyer A','loyer',80000,'${MA1}','2026-07-01','${MA1}'),
    ('${EB}','${HB}','Loyer B','loyer',70000,'${MB1}','2026-07-01','${MB1}');

  insert into expense_share (id, expense_id, member_id, share_cents, share_pct_snapshot) values
    ('${SHA}','${EA}','${MA1}',40000,50), ('${SHB}','${EB}','${MB1}',70000,100);

  insert into aid (id, expense_id, beneficiary_member_id, label, amount_cents) values
    ('${AIDA}','${EA}','${MA1}','APL',20000), ('${AIDB}','${EB}','${MB1}','APL',10000);

  insert into recurring_template (id, household_id, label, category, amount_cents, payer_member_id, day_of_month, shares_config) values
    ('${TA}','${HA}','Loyer','loyer',80000,'${MA1}',5,'[]'::jsonb),
    ('${TB}','${HB}','Loyer','loyer',70000,'${MB1}',5,'[]'::jsonb);

  insert into recurring_aid (id, template_id, beneficiary_member_id, label, amount_cents) values
    ('${RAA}','${TA}','${MA1}','APL',20000), ('${RAB}','${TB}','${MB1}','APL',10000);

  insert into recurring_occurrence (id, template_id, period, expense_id) values
    ('${OCA}','${TA}','2026-07-01','${EA}'), ('${OCB}','${TB}','2026-07-01','${EB}');
`;

/** Exécute `sql` en se faisant passer pour `authUid` (rôle authenticated), puis rollback. */
async function queryAs(authUid: string, sql: string): Promise<pkg.QueryResult> {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: authUid, role: "authenticated" }),
    ]);
    const res = await client.query(sql);
    await client.query("rollback");
    return res;
  } catch (err) {
    await client.query("rollback");
    throw err;
  }
}

async function visibleCount(authUid: string, table: string, where: string): Promise<number> {
  const res = await queryAs(authUid, `select count(*)::int as c from ${table} where ${where}`);
  return res.rows[0].c as number;
}

beforeAll(async () => {
  await client.connect();
  await client.query(cleanupSql);
  await client.query(fixturesSql);
});

afterAll(async () => {
  await client.query(cleanupSql);
  await client.end();
});

// Localisateur d'une ligne du foyer A (+ setter d'UPDATE) par table.
const CASES: { table: string; where: string; set: string }[] = [
  { table: "household", where: `id = '${HA}'`, set: `name = 'x'` },
  { table: "member", where: `id in ('${MA1}','${MA2}')`, set: `display_name = 'x'` },
  { table: "membership", where: `household_id = '${HA}'`, set: `role = 'member'` },
  { table: "settlement", where: `id = '${STA}'`, set: `amount_cents = 999` },
  { table: "expense", where: `id = '${EA}'`, set: `label = 'x'` },
  { table: "recurring_template", where: `id = '${TA}'`, set: `label = 'x'` },
  // enfants (héritent via le parent)
  { table: "expense_share", where: `id = '${SHA}'`, set: `share_cents = 1` },
  { table: "aid", where: `id = '${AIDA}'`, set: `label = 'x'` },
  { table: "recurring_aid", where: `id = '${RAA}'`, set: `label = 'x'` },
  { table: "recurring_occurrence", where: `id = '${OCA}'`, set: `period = '2026-08-01'` },
];

describe("RLS — un membre du foyer B (Bob) ne peut PAS accéder au foyer A", () => {
  it.each(CASES)("SELECT $table du foyer A → 0 ligne visible", async ({ table, where }) => {
    expect(await visibleCount(UB1, table, where)).toBe(0);
  });

  it.each(CASES)("UPDATE $table du foyer A → 0 ligne affectée", async ({ table, where, set }) => {
    const res = await queryAs(UB1, `update ${table} set ${set} where ${where}`);
    expect(res.rowCount).toBe(0);
  });

  it.each(CASES)("DELETE $table du foyer A → 0 ligne affectée", async ({ table, where }) => {
    const res = await queryAs(UB1, `delete from ${table} where ${where}`);
    expect(res.rowCount).toBe(0);
  });

  it("INSERT expense (parent) dans le foyer A → rejeté (WITH CHECK)", async () => {
    await expect(
      queryAs(
        UB1,
        `insert into expense (household_id, label, category, gross_amount_cents, payer_member_id, incurred_on)
         values ('${HA}','pirate','autre',100,'${MB1}','2026-07-01')`,
      ),
    ).rejects.toThrow();
  });

  it("INSERT membership dans le foyer A → rejeté (WITH CHECK)", async () => {
    await expect(
      queryAs(
        UB1,
        `insert into membership (household_id, member_id, default_share_pct) values ('${HA}','${MB1}',10)`,
      ),
    ).rejects.toThrow();
  });

  it("INSERT aid (enfant) sur une dépense du foyer A → rejeté (WITH CHECK)", async () => {
    await expect(
      queryAs(
        UB1,
        `insert into aid (expense_id, beneficiary_member_id, label, amount_cents)
         values ('${EA}','${MB1}','pirate',100)`,
      ),
    ).rejects.toThrow();
  });

  it("Bob ne voit pas les membres du foyer A", async () => {
    expect(await visibleCount(UB1, "member", `id in ('${MA1}','${MA2}')`)).toBe(0);
  });
});

describe("RLS — les DEUX membres du foyer A (Alice & Amir) accèdent à leurs données", () => {
  it.each(CASES)("Alice voit $table du foyer A", async ({ table, where }) => {
    expect(await visibleCount(UA1, table, where)).toBeGreaterThan(0);
  });

  it.each(CASES)("Amir (co-membre) voit $table du foyer A", async ({ table, where }) => {
    expect(await visibleCount(UA2, table, where)).toBeGreaterThan(0);
  });

  it("Alice peut UPDATE une dépense du foyer A (1 ligne)", async () => {
    const res = await queryAs(UA1, `update expense set label = 'maj' where id = '${EA}'`);
    expect(res.rowCount).toBe(1);
  });

  it("Alice peut INSERT une dépense dans le foyer A", async () => {
    const res = await queryAs(
      UA1,
      `insert into expense (household_id, label, category, gross_amount_cents, payer_member_id, incurred_on)
       values ('${HA}','Courses','courses',4200,'${MA1}','2026-07-02')`,
    );
    expect(res.rowCount).toBe(1);
  });

  it("Alice peut INSERT une aide (enfant) sur une dépense du foyer A", async () => {
    const res = await queryAs(
      UA1,
      `insert into aid (expense_id, beneficiary_member_id, label, amount_cents)
       values ('${EA}','${MA1}','CAF',500)`,
    );
    expect(res.rowCount).toBe(1);
  });

  it("Alice voit Amir (co-membre) mais PAS Bob", async () => {
    expect(await visibleCount(UA1, "member", `id = '${MA2}'`)).toBe(1);
    expect(await visibleCount(UA1, "member", `id = '${MB1}'`)).toBe(0);
  });

  it("symétrie : Alice ne voit AUCUNE donnée du foyer B", async () => {
    expect(await visibleCount(UA1, "expense", `id = '${EB}'`)).toBe(0);
    expect(await visibleCount(UA1, "household", `id = '${HB}'`)).toBe(0);
    expect(await visibleCount(UA1, "expense_share", `id = '${SHB}'`)).toBe(0);
  });
});
