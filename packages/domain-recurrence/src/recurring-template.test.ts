import { describe, it, expect, beforeEach } from "vitest";
import {
  createRecurringTemplate,
  updateRecurringTemplate,
  deactivateRecurringTemplate,
} from "./index";
import type {
  NewRecurringAid,
  NewRecurringTemplate,
  RecurringTemplateRepository,
  RecurringTemplateScalarPatch,
  StoredRecurringTemplate,
} from "./repository";
import type { RecurrenceContext } from "./types";

// ── FakeRecurringTemplateRepository : implémentation en mémoire du port (DA11,
// tests légers, zéro Docker). Prouve le CÂBLAGE (validations avant persistance,
// patch minimal) ; aucune arithmétique de parts ici (déclaratif jusqu'à T-C7.2). ──
class FakeRecurringTemplateRepository implements RecurringTemplateRepository {
  private templates = new Map<string, StoredRecurringTemplate>();
  private seq = 0;

  createCount = 0;
  updateCount = 0;
  deactivateCount = 0;
  lastCreate: { template: NewRecurringTemplate; aids: NewRecurringAid[] } | null = null;
  lastUpdatePatch: RecurringTemplateScalarPatch | null = null;

  constructor(private readonly membersByHousehold: Record<string, string[]>) {}

  /** Injecte un template arbitraire (ex. inactif, d'un autre foyer). */
  seed(template: StoredRecurringTemplate): void {
    this.templates.set(template.id, template);
  }

  async getHouseholdMemberIds(householdId: string): Promise<string[]> {
    return this.membersByHousehold[householdId] ?? [];
  }

  async createRecurringTemplateWithAids(
    template: NewRecurringTemplate,
    aids: NewRecurringAid[],
  ): Promise<StoredRecurringTemplate> {
    this.createCount += 1;
    this.lastCreate = { template, aids };
    const id = `tpl-${this.seq++}`;
    const stored: StoredRecurringTemplate = {
      id,
      householdId: template.householdId,
      label: template.label,
      category: template.category,
      amountCents: template.amountCents,
      payerId: template.payerId,
      dayOfMonth: template.dayOfMonth,
      shares: template.shares,
      active: true,
      createdAt: new Date().toISOString(),
      aids: aids.map((a) => ({
        id: `aid-${this.seq++}`,
        beneficiaryId: a.beneficiaryId,
        label: a.label,
        amountCents: a.amountCents,
      })),
    };
    this.templates.set(id, stored);
    return stored;
  }

  async getRecurringTemplateById(templateId: string): Promise<StoredRecurringTemplate | null> {
    return this.templates.get(templateId) ?? null;
  }

  async updateRecurringTemplate(
    templateId: string,
    patch: RecurringTemplateScalarPatch,
  ): Promise<StoredRecurringTemplate> {
    this.updateCount += 1;
    this.lastUpdatePatch = patch;
    const current = this.templates.get(templateId);
    if (!current) throw new Error("test: updateRecurringTemplate sur template inconnu");
    const updated: StoredRecurringTemplate = { ...current, ...patch };
    this.templates.set(templateId, updated);
    return updated;
  }

  async deactivateRecurringTemplate(templateId: string): Promise<{ id: string; active: false }> {
    this.deactivateCount += 1;
    const current = this.templates.get(templateId);
    if (!current) throw new Error("test: deactivateRecurringTemplate sur template inconnu");
    this.templates.set(templateId, { ...current, active: false });
    return { id: templateId, active: false };
  }
}

const HOUSEHOLD = "H";
const ctx: RecurrenceContext = { memberId: "A", householdId: HOUSEHOLD };
const ratio5050 = [
  { memberId: "A", pct: 50 },
  { memberId: "B", pct: 50 },
];

function baseTemplate(overrides: Partial<StoredRecurringTemplate> = {}): StoredRecurringTemplate {
  return {
    id: "tpl-1",
    householdId: HOUSEHOLD,
    label: "Loyer",
    category: "loyer",
    amountCents: 80000,
    payerId: "A",
    dayOfMonth: 5,
    shares: ratio5050,
    active: true,
    createdAt: new Date().toISOString(),
    aids: [],
    ...overrides,
  };
}

let repo: FakeRecurringTemplateRepository;
beforeEach(() => {
  repo = new FakeRecurringTemplateRepository({ [HOUSEHOLD]: ["A", "B"] });
});

describe("createRecurringTemplate (spec ch.5.4, T-C7.1)", () => {
  it("template valide sans aides → créé, persisté", async () => {
    const res = await createRecurringTemplate(repo, ctx, {
      householdId: HOUSEHOLD,
      label: "Loyer",
      category: "loyer",
      amountCents: 80000,
      payerId: "A",
      dayOfMonth: 5,
      shares: ratio5050,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.label).toBe("Loyer");
    expect(res.data.active).toBe(true);
    expect(repo.createCount).toBe(1);
    expect(repo.lastCreate?.aids).toEqual([]);
  });

  it("template valide avec aides → template + aides créés ensemble", async () => {
    const res = await createRecurringTemplate(repo, ctx, {
      householdId: HOUSEHOLD,
      label: "Loyer",
      category: "loyer",
      amountCents: 80000,
      payerId: "A",
      dayOfMonth: 5,
      shares: ratio5050,
      aids: [{ beneficiaryId: "B", label: "APL", amountCents: 20000 }],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.aids).toHaveLength(1);
    expect(res.data.aids[0].label).toBe("APL");
    expect(repo.lastCreate?.aids).toHaveLength(1);
  });

  it("amountCents ≤ 0 → VALIDATION_ERROR, aucune création", async () => {
    const res = await createRecurringTemplate(repo, ctx, {
      householdId: HOUSEHOLD,
      label: "Loyer",
      category: "loyer",
      amountCents: 0,
      payerId: "A",
      dayOfMonth: 5,
      shares: ratio5050,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("VALIDATION_ERROR");
    expect(repo.createCount).toBe(0);
  });

  it("dayOfMonth hors 1-31 → VALIDATION_ERROR (dayOfMonth), aucune création", async () => {
    const res = await createRecurringTemplate(repo, ctx, {
      householdId: HOUSEHOLD,
      label: "Loyer",
      category: "loyer",
      amountCents: 80000,
      payerId: "A",
      dayOfMonth: 32,
      shares: ratio5050,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("VALIDATION_ERROR");
    expect(res.error.field).toBe("dayOfMonth");
    expect(repo.createCount).toBe(0);
  });

  it("dayOfMonth = 0 → VALIDATION_ERROR (dayOfMonth)", async () => {
    const res = await createRecurringTemplate(repo, ctx, {
      householdId: HOUSEHOLD,
      label: "Loyer",
      category: "loyer",
      amountCents: 80000,
      payerId: "A",
      dayOfMonth: 0,
      shares: ratio5050,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.field).toBe("dayOfMonth");
  });

  it("Σ pct ≠ 100 → VALIDATION_ERROR (shares), aucune création", async () => {
    const res = await createRecurringTemplate(repo, ctx, {
      householdId: HOUSEHOLD,
      label: "Loyer",
      category: "loyer",
      amountCents: 80000,
      payerId: "A",
      dayOfMonth: 5,
      shares: [
        { memberId: "A", pct: 60 },
        { memberId: "B", pct: 60 },
      ],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("VALIDATION_ERROR");
    expect(res.error.field).toBe("shares");
    expect(repo.createCount).toBe(0);
  });

  it("label vide → VALIDATION_ERROR", async () => {
    const res = await createRecurringTemplate(repo, ctx, {
      householdId: HOUSEHOLD,
      label: "  ",
      category: "loyer",
      amountCents: 80000,
      payerId: "A",
      dayOfMonth: 5,
      shares: ratio5050,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("VALIDATION_ERROR");
  });

  it("payeur hors foyer → VALIDATION_ERROR (payerId), aucune création", async () => {
    const res = await createRecurringTemplate(repo, ctx, {
      householdId: HOUSEHOLD,
      label: "Loyer",
      category: "loyer",
      amountCents: 80000,
      payerId: "Z",
      dayOfMonth: 5,
      shares: ratio5050,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("VALIDATION_ERROR");
    expect(res.error.field).toBe("payerId");
    expect(repo.createCount).toBe(0);
  });

  it("part hors foyer → VALIDATION_ERROR (shares)", async () => {
    const res = await createRecurringTemplate(repo, ctx, {
      householdId: HOUSEHOLD,
      label: "Loyer",
      category: "loyer",
      amountCents: 80000,
      payerId: "A",
      dayOfMonth: 5,
      shares: [
        { memberId: "A", pct: 50 },
        { memberId: "Z", pct: 50 },
      ],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.field).toBe("shares");
    expect(repo.createCount).toBe(0);
  });

  it("bénéficiaire d'aide hors foyer → VALIDATION_ERROR (aids), aucune création", async () => {
    const res = await createRecurringTemplate(repo, ctx, {
      householdId: HOUSEHOLD,
      label: "Loyer",
      category: "loyer",
      amountCents: 80000,
      payerId: "A",
      dayOfMonth: 5,
      shares: ratio5050,
      aids: [{ beneficiaryId: "Z", label: "APL", amountCents: 20000 }],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("VALIDATION_ERROR");
    expect(res.error.field).toBe("aids");
    expect(repo.createCount).toBe(0);
  });

  it("aide avec amountCents ≤ 0 → VALIDATION_ERROR, aucune création", async () => {
    const res = await createRecurringTemplate(repo, ctx, {
      householdId: HOUSEHOLD,
      label: "Loyer",
      category: "loyer",
      amountCents: 80000,
      payerId: "A",
      dayOfMonth: 5,
      shares: ratio5050,
      aids: [{ beneficiaryId: "A", label: "APL", amountCents: 0 }],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("VALIDATION_ERROR");
    expect(repo.createCount).toBe(0);
  });

  it("foyer non autorisé (mismatch seam) → FORBIDDEN, aucune création", async () => {
    const res = await createRecurringTemplate(repo, ctx, {
      householdId: "AUTRE",
      label: "Loyer",
      category: "loyer",
      amountCents: 80000,
      payerId: "A",
      dayOfMonth: 5,
      shares: ratio5050,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("FORBIDDEN");
    expect(repo.createCount).toBe(0);
  });
});

describe("updateRecurringTemplate (patch minimal)", () => {
  it("patch label seul → ok, seul label modifié dans le patch scalaire", async () => {
    repo.seed(baseTemplate());
    const res = await updateRecurringTemplate(repo, ctx, {
      templateId: "tpl-1",
      patch: { label: "Loyer appartement" },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.label).toBe("Loyer appartement");
    expect(repo.lastUpdatePatch).toEqual({ label: "Loyer appartement" });
  });

  it("patch shares Σ ≠ 100 → VALIDATION_ERROR, aucune mise à jour", async () => {
    repo.seed(baseTemplate());
    const res = await updateRecurringTemplate(repo, ctx, {
      templateId: "tpl-1",
      patch: {
        shares: [
          { memberId: "A", pct: 40 },
          { memberId: "B", pct: 40 },
        ],
      },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("VALIDATION_ERROR");
    expect(res.error.field).toBe("shares");
    expect(repo.updateCount).toBe(0);
  });

  it("patch payerId vers non-membre → VALIDATION_ERROR (payerId)", async () => {
    repo.seed(baseTemplate());
    const res = await updateRecurringTemplate(repo, ctx, {
      templateId: "tpl-1",
      patch: { payerId: "Z" },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.field).toBe("payerId");
    expect(repo.updateCount).toBe(0);
  });

  it("patch dayOfMonth hors 1-31 → VALIDATION_ERROR (dayOfMonth)", async () => {
    repo.seed(baseTemplate());
    const res = await updateRecurringTemplate(repo, ctx, {
      templateId: "tpl-1",
      patch: { dayOfMonth: 32 },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.field).toBe("dayOfMonth");
    expect(repo.updateCount).toBe(0);
  });

  it("template d'un autre foyer (mismatch seam) → NOT_FOUND", async () => {
    repo.seed(baseTemplate({ householdId: "AUTRE" }));
    const res = await updateRecurringTemplate(repo, ctx, {
      templateId: "tpl-1",
      patch: { label: "X" },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("NOT_FOUND");
    expect(repo.updateCount).toBe(0);
  });

  it("templateId inconnu → NOT_FOUND", async () => {
    const res = await updateRecurringTemplate(repo, ctx, {
      templateId: "nope",
      patch: { label: "X" },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("NOT_FOUND");
  });
});

describe("deactivateRecurringTemplate (spec ch.5.4)", () => {
  it("template actif → active=false, aucune suppression", async () => {
    repo.seed(baseTemplate());
    const res = await deactivateRecurringTemplate(repo, ctx, { templateId: "tpl-1" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({ id: "tpl-1", active: false });
    expect(repo.deactivateCount).toBe(1);
    expect(await repo.getRecurringTemplateById("tpl-1")).not.toBeNull();
  });

  it("template déjà inactif → désactivation idempotente, toujours ok", async () => {
    repo.seed(baseTemplate({ active: false }));
    const res = await deactivateRecurringTemplate(repo, ctx, { templateId: "tpl-1" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.active).toBe(false);
  });

  it("template d'un autre foyer (mismatch seam) → NOT_FOUND, aucune désactivation", async () => {
    repo.seed(baseTemplate({ householdId: "AUTRE" }));
    const res = await deactivateRecurringTemplate(repo, ctx, { templateId: "tpl-1" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("NOT_FOUND");
    expect(repo.deactivateCount).toBe(0);
  });

  it("templateId inconnu → NOT_FOUND", async () => {
    const res = await deactivateRecurringTemplate(repo, ctx, { templateId: "nope" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("NOT_FOUND");
  });
});
