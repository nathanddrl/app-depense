import { describe, it, expect } from "vitest";
import { runRecurringGeneration } from "./index";
import type {
  GenerateOccurrenceInput,
  GeneratedOccurrence,
  RecurringTemplateRepository,
  StoredRecurringTemplate,
  TemplateForGeneration,
} from "./repository";

// ── FakeGenerationRepository : implémentation en mémoire du port, focalisée sur
// la génération (DA11, tests légers, zéro Docker). Prouve le CÂBLAGE (l'idempotence
// vient de la contrainte unique DB, simulée ici par un Set `(templateId, period)`)
// et que les parts persistées viennent bien de calc-engine (jamais recalculées). ──
class FakeGenerationRepository implements RecurringTemplateRepository {
  private generated = new Set<string>(); // clé `${templateId}:${period}`
  private seq = 0;

  generateCalls: GenerateOccurrenceInput[] = [];

  constructor(private readonly templates: TemplateForGeneration[]) {}

  async getHouseholdMemberIds(): Promise<string[]> {
    throw new Error("test: getHouseholdMemberIds non exercé par ce fichier");
  }
  async createRecurringTemplateWithAids(): Promise<StoredRecurringTemplate> {
    throw new Error("test: createRecurringTemplateWithAids non exercé par ce fichier");
  }
  async getRecurringTemplateById(): Promise<StoredRecurringTemplate | null> {
    throw new Error("test: getRecurringTemplateById non exercé par ce fichier");
  }
  async updateRecurringTemplate(): Promise<StoredRecurringTemplate> {
    throw new Error("test: updateRecurringTemplate non exercé par ce fichier");
  }
  async deactivateRecurringTemplate(): Promise<{ id: string; active: false }> {
    throw new Error("test: deactivateRecurringTemplate non exercé par ce fichier");
  }

  async listActiveTemplatesForGeneration(): Promise<TemplateForGeneration[]> {
    return this.templates;
  }
  async listRecurringTemplatesForHousehold(): Promise<StoredRecurringTemplate[]> {
    throw new Error("test: listRecurringTemplatesForHousehold non exercé par ce fichier");
  }

  /** Simule la contrainte unique `(template_id, period)` : source de l'idempotence. */
  async generateOccurrence(input: GenerateOccurrenceInput): Promise<GeneratedOccurrence | null> {
    this.generateCalls.push(input);
    const key = `${input.templateId}:${input.period}`;
    if (this.generated.has(key)) return null;
    this.generated.add(key);
    this.seq += 1;
    return { occurrenceId: `occ-${this.seq}`, expenseId: `exp-${this.seq}` };
  }
}

const ratio5050 = [
  { memberId: "A", pct: 50 },
  { memberId: "B", pct: 50 },
];

function template(overrides: Partial<TemplateForGeneration> = {}): TemplateForGeneration {
  return {
    id: "tpl-1",
    householdId: "H",
    label: "Loyer",
    category: "loyer",
    amountCents: 80000,
    payerId: "A",
    dayOfMonth: 5,
    shares: ratio5050,
    aids: [],
    ...overrides,
  };
}

// 2026-07-14 (UTC) : jour 14, après le jour 5 mais avant le jour 20.
const RUN_AFTER_5 = new Date("2026-07-14T00:00:00Z");

describe("runRecurringGeneration (spec ch.5.4, T-C7.2)", () => {
  it("template actif jour 5 → génération le 14 → occurrence créée avec parts calc-engine", async () => {
    const repo = new FakeGenerationRepository([template()]);
    const res = await runRecurringGeneration(repo, RUN_AFTER_5);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.results).toEqual([
      { templateId: "tpl-1", status: "generated", expenseId: "exp-1", occurrenceId: "occ-1" },
    ]);
    expect(repo.generateCalls).toHaveLength(1);
    const call = repo.generateCalls[0];
    expect(call.period).toBe("2026-07-01");
    expect(call.incurredOn).toBe("2026-07-05");
    const byMember = Object.fromEntries(call.shares.map((s) => [s.memberId, s.cents]));
    expect(byMember.A).toBe(40000);
    expect(byMember.B).toBe(40000);
  });

  it("aides récurrentes réduisent le net via calc-engine (pipeline aide→net, 4.1)", async () => {
    const repo = new FakeGenerationRepository([
      template({ aids: [{ beneficiaryId: "A", label: "APL", amountCents: 20000 }] }),
    ]);
    const res = await runRecurringGeneration(repo, RUN_AFTER_5);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const call = repo.generateCalls[0];
    // brut 800€ − aide 200€ = 600€, réparti 50/50 → 300€/300€
    const byMember = Object.fromEntries(call.shares.map((s) => [s.memberId, s.cents]));
    expect(byMember.A).toBe(30000);
    expect(byMember.B).toBe(30000);
  });

  it("jour du mois pas encore atteint → skipped « day-not-reached », aucun appel repo", async () => {
    const repo = new FakeGenerationRepository([template({ dayOfMonth: 20 })]);
    const res = await runRecurringGeneration(repo, RUN_AFTER_5); // le 14, avant le 20
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.results).toEqual([
      { templateId: "tpl-1", status: "skipped", reason: "day-not-reached" },
    ]);
    expect(repo.generateCalls).toHaveLength(0);
  });

  it("re-run sur la même période → aucune occurrence en double, aucun crash", async () => {
    const repo = new FakeGenerationRepository([template()]);
    const first = await runRecurringGeneration(repo, RUN_AFTER_5);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.results[0].status).toBe("generated");

    const second = await runRecurringGeneration(repo, RUN_AFTER_5);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data.results).toEqual([
      { templateId: "tpl-1", status: "skipped", reason: "already-generated" },
    ]);
    expect(repo.generateCalls).toHaveLength(2); // 1 génération + 1 tentative idempotente
  });

  it("plusieurs templates dont un déjà généré → seuls les manquants génèrent", async () => {
    const repo = new FakeGenerationRepository([
      template({ id: "tpl-1" }),
      template({ id: "tpl-2", label: "Internet", amountCents: 3000 }),
    ]);
    await runRecurringGeneration(repo, RUN_AFTER_5); // génère les deux

    const res = await runRecurringGeneration(repo, RUN_AFTER_5); // re-run
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.results).toEqual([
      { templateId: "tpl-1", status: "skipped", reason: "already-generated" },
      { templateId: "tpl-2", status: "skipped", reason: "already-generated" },
    ]);
  });

  it("un template en échec n'empêche pas la génération des autres", async () => {
    const repo = new FakeGenerationRepository([
      template({ id: "tpl-1", shares: [{ memberId: "A", pct: 60 }] }), // Σ pct ≠ 100 → CalcPreconditionError
      template({ id: "tpl-2", label: "Internet", amountCents: 3000 }),
    ]);
    const res = await runRecurringGeneration(repo, RUN_AFTER_5);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.results[0]).toMatchObject({ templateId: "tpl-1", status: "failed" });
    expect(res.data.results[1]).toMatchObject({ templateId: "tpl-2", status: "generated" });
  });

  it("aucun template actif → résultats vides, aucun crash", async () => {
    const repo = new FakeGenerationRepository([]);
    const res = await runRecurringGeneration(repo, RUN_AFTER_5);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.results).toEqual([]);
  });
});

describe("runRecurringGeneration — bord de mois (D14, T-C7.3)", () => {
  it("day_of_month=31 en février non bissextile (2026, 28 jours) → génération le 28, pas d'erreur", async () => {
    const repo = new FakeGenerationRepository([template({ dayOfMonth: 31 })]);
    const res = await runRecurringGeneration(repo, new Date("2026-02-28T00:00:00Z"));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.results[0].status).toBe("generated");
    expect(repo.generateCalls[0].period).toBe("2026-02-01");
    expect(repo.generateCalls[0].incurredOn).toBe("2026-02-28");
  });

  it("day_of_month=31 en février bissextile (2028, 29 jours) → génération le 29", async () => {
    const repo = new FakeGenerationRepository([template({ dayOfMonth: 31 })]);
    const res = await runRecurringGeneration(repo, new Date("2028-02-29T00:00:00Z"));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.results[0].status).toBe("generated");
    expect(repo.generateCalls[0].incurredOn).toBe("2028-02-29");
  });

  it("day_of_month=31 en avril (30 jours) → génération le 30", async () => {
    const repo = new FakeGenerationRepository([template({ dayOfMonth: 31 })]);
    const res = await runRecurringGeneration(repo, new Date("2026-04-30T00:00:00Z"));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.results[0].status).toBe("generated");
    expect(repo.generateCalls[0].period).toBe("2026-04-01");
    expect(repo.generateCalls[0].incurredOn).toBe("2026-04-30");
  });

  it("day_of_month=31 en juillet (31 jours) → aucun clamp, génération le 31", async () => {
    const repo = new FakeGenerationRepository([template({ dayOfMonth: 31 })]);
    const res = await runRecurringGeneration(repo, new Date("2026-07-31T00:00:00Z"));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(repo.generateCalls[0].incurredOn).toBe("2026-07-31");
  });

  it("day_of_month=31 clampé à 28 en février → avant le 28, day-not-reached (pas un skip prématuré sur 31)", async () => {
    const repo = new FakeGenerationRepository([template({ dayOfMonth: 31 })]);
    const res = await runRecurringGeneration(repo, new Date("2026-02-20T00:00:00Z"));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.results).toEqual([
      { templateId: "tpl-1", status: "skipped", reason: "day-not-reached" },
    ]);
  });
});
