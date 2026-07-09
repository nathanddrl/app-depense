import { describe, it, expect } from "vitest";
import { runRecurringGeneration, updateRecurringTemplate } from "./index";
import type {
  GenerateOccurrenceInput,
  GeneratedOccurrence,
  RecurringTemplateRepository,
  RecurringTemplateScalarPatch,
  StoredRecurringTemplate,
  TemplateForGeneration,
} from "./repository";
import type { RecurrenceContext } from "./types";

// ── FakeFullRepository : seul fake du package qui combine CRUD (T-C7.1) et
// génération (T-C7.2), nécessaire pour prouver D13 de bout en bout : éditer un
// template APRÈS génération ne doit jamais retoucher une occurrence déjà
// persistée. Les occurrences sont stockées dans un ledger immuable, séparé de
// la map des templates — comme en DB, où `expense_share`/`recurring_occurrence`
// ne sont jamais mis à jour par `updateRecurringTemplate`. ─────────────────────
class FakeFullRepository implements RecurringTemplateRepository {
  private templates = new Map<string, StoredRecurringTemplate>();
  private occurrences = new Map<string, GenerateOccurrenceInput>();
  private seq = 0;

  seed(template: StoredRecurringTemplate): void {
    this.templates.set(template.id, template);
  }

  /** Snapshot persisté d'une occurrence (jamais modifié après coup). */
  getOccurrence(templateId: string, period: string): GenerateOccurrenceInput | undefined {
    return this.occurrences.get(`${templateId}:${period}`);
  }

  async getHouseholdMemberIds(): Promise<string[]> {
    return ["A", "B"];
  }
  async createRecurringTemplateWithAids(): Promise<StoredRecurringTemplate> {
    throw new Error("test: createRecurringTemplateWithAids non exercé par ce fichier");
  }

  async getRecurringTemplateById(templateId: string): Promise<StoredRecurringTemplate | null> {
    return this.templates.get(templateId) ?? null;
  }

  async updateRecurringTemplate(
    templateId: string,
    patch: RecurringTemplateScalarPatch,
  ): Promise<StoredRecurringTemplate> {
    const current = this.templates.get(templateId);
    if (!current) throw new Error("test: updateRecurringTemplate sur template inconnu");
    const updated: StoredRecurringTemplate = { ...current, ...patch };
    this.templates.set(templateId, updated);
    return updated;
  }

  async deactivateRecurringTemplate(): Promise<{ id: string; active: false }> {
    throw new Error("test: deactivateRecurringTemplate non exercé par ce fichier");
  }

  async listRecurringTemplatesForHousehold(): Promise<StoredRecurringTemplate[]> {
    throw new Error("test: listRecurringTemplatesForHousehold non exercé par ce fichier");
  }

  async listActiveTemplatesForGeneration(): Promise<TemplateForGeneration[]> {
    return [...this.templates.values()]
      .filter((t) => t.active)
      .map((t) => ({
        id: t.id,
        householdId: t.householdId,
        label: t.label,
        category: t.category,
        amountCents: t.amountCents,
        payerId: t.payerId,
        dayOfMonth: t.dayOfMonth,
        shares: t.shares,
        aids: t.aids.map((a) => ({
          beneficiaryId: a.beneficiaryId,
          label: a.label,
          amountCents: a.amountCents,
        })),
      }));
  }

  async generateOccurrence(input: GenerateOccurrenceInput): Promise<GeneratedOccurrence | null> {
    const key = `${input.templateId}:${input.period}`;
    if (this.occurrences.has(key)) return null;
    this.occurrences.set(key, input);
    this.seq += 1;
    return { occurrenceId: `occ-${this.seq}`, expenseId: `exp-${this.seq}` };
  }
}

const ctx: RecurrenceContext = { memberId: "A", householdId: "H" };
const ratio5050 = [
  { memberId: "A", pct: 50 },
  { memberId: "B", pct: 50 },
];

describe("D13 — non-rétroactivité de l'édition du montant (T-C7.3)", () => {
  it("modifier amountCents après génération ne touche pas l'occurrence passée ; seule une génération future utilise le nouveau montant", async () => {
    const repo = new FakeFullRepository();
    repo.seed({
      id: "tpl-1",
      householdId: "H",
      label: "Loyer",
      category: "loyer",
      amountCents: 80000,
      payerId: "A",
      dayOfMonth: 5,
      shares: ratio5050,
      active: true,
      createdAt: new Date().toISOString(),
      aids: [],
    });

    // Génération de juillet avec le montant d'origine (800€).
    const july = await runRecurringGeneration(repo, new Date("2026-07-14T00:00:00Z"));
    expect(july.ok).toBe(true);
    if (!july.ok) return;
    expect(july.data.results[0].status).toBe("generated");

    // Édition du template : le montant passe à 1000€.
    const updated = await updateRecurringTemplate(repo, ctx, {
      templateId: "tpl-1",
      patch: { amountCents: 100000 },
    });
    expect(updated.ok).toBe(true);

    // L'occurrence de juillet, déjà persistée, garde ses parts d'origine (800€).
    const julyOccurrence = repo.getOccurrence("tpl-1", "2026-07-01");
    expect(julyOccurrence).toBeDefined();
    const julyTotal = julyOccurrence?.shares.reduce((sum, s) => sum + s.cents, 0);
    expect(julyTotal).toBe(80000);

    // Génération d'août : relit le template à jour, utilise le nouveau montant (1000€).
    const august = await runRecurringGeneration(repo, new Date("2026-08-14T00:00:00Z"));
    expect(august.ok).toBe(true);
    if (!august.ok) return;
    expect(august.data.results[0].status).toBe("generated");

    const augustOccurrence = repo.getOccurrence("tpl-1", "2026-08-01");
    expect(augustOccurrence).toBeDefined();
    const augustTotal = augustOccurrence?.shares.reduce((sum, s) => sum + s.cents, 0);
    expect(augustTotal).toBe(100000);
  });
});
