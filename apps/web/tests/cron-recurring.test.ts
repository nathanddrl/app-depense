// Suite d'intégration — Route Handler cron récurrence (spec ch.5.4, T-C7.4).
//
// Ne recode AUCUNE logique métier de `runRecurringGeneration` (idempotence,
// bord de mois, calcul des parts via calc-engine) : déjà couverte en
// T-C7.2/T-C7.3 dans `@app/domain-recurrence`. Cette suite vérifie UNIQUEMENT
// l'enveloppe HTTP de la route : vérification du secret (401 si absent/incorrect,
// sans exécuter la génération), et forme JSON de la réponse ({ generated, skipped,
// failed }) à partir d'un `RecurringTemplateRepository` fake injecté.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET, isAuthorizedCronRequest, runCronGeneration } from "../app/api/cron/recurring/route";
import type {
  GenerateOccurrenceInput,
  GeneratedOccurrence,
  RecurringTemplateRepository,
  StoredRecurringTemplate,
  TemplateForGeneration,
} from "@app/domain-recurrence";

// ── FakeRepository minimal : seules les deux méthodes utilisées par
// `runRecurringGeneration` sont exercées ici (DA11, tests légers, zéro Docker). ──
class FakeRepository implements RecurringTemplateRepository {
  private generated = new Set<string>();

  constructor(private readonly templates: TemplateForGeneration[]) {}

  async getHouseholdMemberIds(): Promise<string[]> {
    throw new Error("non exercé par cette suite");
  }
  async createRecurringTemplateWithAids(): Promise<StoredRecurringTemplate> {
    throw new Error("non exercé par cette suite");
  }
  async getRecurringTemplateById(): Promise<StoredRecurringTemplate | null> {
    throw new Error("non exercé par cette suite");
  }
  async updateRecurringTemplate(): Promise<StoredRecurringTemplate> {
    throw new Error("non exercé par cette suite");
  }
  async deactivateRecurringTemplate(): Promise<{ id: string; active: false }> {
    throw new Error("non exercé par cette suite");
  }

  async listActiveTemplatesForGeneration(): Promise<TemplateForGeneration[]> {
    return this.templates;
  }

  async generateOccurrence(input: GenerateOccurrenceInput): Promise<GeneratedOccurrence | null> {
    const key = `${input.templateId}:${input.period}`;
    if (this.generated.has(key)) return null;
    this.generated.add(key);
    return { occurrenceId: `occ-${key}`, expenseId: `exp-${key}` };
  }
}

function template(overrides: Partial<TemplateForGeneration> = {}): TemplateForGeneration {
  return {
    id: "tpl-1",
    householdId: "H",
    label: "Loyer",
    category: "loyer",
    amountCents: 80000,
    payerId: "A",
    dayOfMonth: 5,
    shares: [
      { memberId: "A", pct: 50 },
      { memberId: "B", pct: 50 },
    ],
    aids: [],
    ...overrides,
  };
}

const NOW = new Date("2026-07-14T00:00:00Z");
const ORIGINAL_SECRET = process.env.CRON_SECRET;

describe("GET /api/cron/recurring — secret (T-C7.4, critère 2)", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "le-bon-secret";
  });
  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL_SECRET;
  });

  it("aucun header Authorization → 401, aucune génération déclenchée", async () => {
    const request = new Request("http://localhost/api/cron/recurring");
    expect(isAuthorizedCronRequest(request)).toBe(false);

    const res = await GET(request);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("secret incorrect → 401", async () => {
    const request = new Request("http://localhost/api/cron/recurring", {
      headers: { authorization: "Bearer mauvais-secret" },
    });
    expect(isAuthorizedCronRequest(request)).toBe(false);

    const res = await GET(request);
    expect(res.status).toBe(401);
  });

  it("CRON_SECRET non configuré côté serveur → refuse tout secret (fail closed)", async () => {
    delete process.env.CRON_SECRET;
    const request = new Request("http://localhost/api/cron/recurring", {
      headers: { authorization: "Bearer nimporte-quoi" },
    });
    expect(isAuthorizedCronRequest(request)).toBe(false);
  });

  it("bon secret → autorisé (la génération elle-même est vérifiée séparément)", () => {
    const request = new Request("http://localhost/api/cron/recurring", {
      headers: { authorization: "Bearer le-bon-secret" },
    });
    expect(isAuthorizedCronRequest(request)).toBe(true);
  });
});

describe("runCronGeneration — forme JSON de la réponse (T-C7.4, critères 1 et 3)", () => {
  it("template actif jour 5, générable → { generated: 1, skipped: 0, failed: 0 }", async () => {
    const repo = new FakeRepository([template()]);
    const summary = await runCronGeneration(repo, NOW);
    expect(summary).toEqual({ generated: 1, skipped: 0, failed: 0 });
  });

  it("aucun template à générer ce mois-ci → { generated: 0, skipped: 0, failed: 0 }, pas d'erreur", async () => {
    const repo = new FakeRepository([]);
    const summary = await runCronGeneration(repo, NOW);
    expect(summary).toEqual({ generated: 0, skipped: 0, failed: 0 });
  });

  it("template déjà généré pour la période → skipped, pas régénéré", async () => {
    const repo = new FakeRepository([template()]);
    await runCronGeneration(repo, NOW);
    const secondRun = await runCronGeneration(repo, NOW);
    expect(secondRun).toEqual({ generated: 0, skipped: 1, failed: 0 });
  });

  it("plusieurs templates dont un échoue → comptés séparément, pas de crash global", async () => {
    const repo = new FakeRepository([
      template({ id: "tpl-1", shares: [{ memberId: "A", pct: 60 }] }), // Σ pct ≠ 100 → failed
      template({ id: "tpl-2" }),
    ]);
    const summary = await runCronGeneration(repo, NOW);
    expect(summary).toEqual({ generated: 1, skipped: 0, failed: 1 });
  });
});
