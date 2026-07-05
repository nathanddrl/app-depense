import { describe, it, expect, beforeEach } from "vitest";
import { createExpense, updateExpense, deleteExpense, listExpenses } from "./index";
import type {
  ExpenseRepository,
  NewExpense,
  ExpenseScalarPatch,
  StoredExpense,
} from "./repository";
import type { Expense, ExpenseContext, ExpenseShareDTO, ListExpensesFilters } from "./types";

// ── FakeExpenseRepository : implémentation en mémoire du port (DA11, tests légers,
// zéro Docker). Prouve le CÂBLAGE (le domaine persiste les parts renvoyées par
// calc-engine, valide avant de toucher la persistance) ; la justesse arithmétique
// est déjà couverte exhaustivement en C1. ────────────────────────────────────────
class FakeExpenseRepository implements ExpenseRepository {
  private store = new Map<string, StoredExpense>();
  private seq = 0;

  insertCount = 0;
  lastInsert: { expense: NewExpense; shares: ExpenseShareDTO[] } | null = null;

  constructor(private readonly membersByHousehold: Record<string, string[]>) {}

  /** Injecte une dépense stockée arbitraire (ex. verrouillée) pour les tests. */
  seed(expense: StoredExpense): void {
    this.store.set(expense.id, expense);
  }

  async getHouseholdMemberIds(householdId: string): Promise<string[]> {
    return this.membersByHousehold[householdId] ?? [];
  }

  async insertExpenseWithShares(expense: NewExpense, shares: ExpenseShareDTO[]): Promise<Expense> {
    this.insertCount += 1;
    this.lastInsert = { expense, shares };
    const now = `2026-07-04T10:0${this.seq}:00.000Z`;
    const stored: StoredExpense = {
      id: `exp-${this.seq++}`,
      householdId: expense.householdId,
      label: expense.label,
      category: expense.category,
      grossCents: expense.grossCents,
      payerId: expense.payerId,
      incurredOn: expense.incurredOn,
      source: expense.source,
      settlementId: null,
      createdAt: now,
      updatedAt: now,
      shares,
      aids: [],
      deletedAt: null,
    };
    this.store.set(stored.id, stored);
    return this.strip(stored);
  }

  async getExpenseById(expenseId: string): Promise<StoredExpense | null> {
    return this.store.get(expenseId) ?? null;
  }

  async updateExpenseWithShares(
    expenseId: string,
    patch: ExpenseScalarPatch,
    shares: ExpenseShareDTO[],
  ): Promise<Expense> {
    const current = this.store.get(expenseId);
    if (!current) throw new Error("test: updateExpenseWithShares sur id inconnu");
    const updated: StoredExpense = {
      ...current,
      ...patch,
      shares,
      updatedAt: "2026-07-05T10:00:00.000Z",
    };
    this.store.set(expenseId, updated);
    return this.strip(updated);
  }

  async softDeleteExpense(expenseId: string): Promise<{ id: string }> {
    const current = this.store.get(expenseId);
    if (current) this.store.set(expenseId, { ...current, deletedAt: "2026-07-05T10:00:00.000Z" });
    return { id: expenseId };
  }

  async listExpenses(householdId: string, filters: ListExpensesFilters): Promise<Expense[]> {
    return [...this.store.values()]
      .filter((e) => e.householdId === householdId && e.deletedAt === null)
      .filter((e) => (filters.month ? e.incurredOn.startsWith(filters.month) : true))
      .filter((e) => (filters.category ? e.category === filters.category : true))
      .sort((a, b) => (a.incurredOn < b.incurredOn ? 1 : a.incurredOn > b.incurredOn ? -1 : 0))
      .map((e) => this.strip(e));
  }

  async listExpensesForBalance(): Promise<never[]> {
    throw new Error("non utilisé par ces tests (voir get-balance.test.ts)");
  }

  private strip(e: StoredExpense): Expense {
    const { deletedAt: _deletedAt, ...rest } = e;
    return rest;
  }
}

const HOUSEHOLD = "H";
const ctx: ExpenseContext = { memberId: "A", householdId: HOUSEHOLD };
const ratio5050 = [
  { memberId: "A", pct: 50 },
  { memberId: "B", pct: 50 },
];

let repo: FakeExpenseRepository;
beforeEach(() => {
  repo = new FakeExpenseRepository({ [HOUSEHOLD]: ["A", "B"] });
});

const baseInput = {
  householdId: HOUSEHOLD,
  label: "Loyer",
  category: "loyer" as const,
  payerId: "A",
  incurredOn: "2026-07-04",
};

describe("createExpense — nominal & parts figées (5.6 / DoD pt.1-2)", () => {
  it("loyer 800€ payé A en 50/50 → parts figées 40000/40000 issues du moteur", async () => {
    const res = await createExpense(repo, ctx, {
      ...baseInput,
      grossCents: 80000,
      shares: ratio5050,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const byMember = Object.fromEntries(res.data.shares.map((s) => [s.memberId, s]));
    expect(byMember.A.cents).toBe(40000);
    expect(byMember.B.cents).toBe(40000);
    expect(byMember.A.pctSnapshot).toBe(50);
    expect(byMember.B.pctSnapshot).toBe(50);
    // Câblage : dissociation payeur (created_by = acteur), source manuelle.
    expect(repo.lastInsert?.expense.source).toBe("manual");
    expect(repo.lastInsert?.expense.createdBy).toBe("A");
    expect(repo.lastInsert?.expense.payerId).toBe("A");
  });

  it("dépense 100€ en 50/50 → parts 5000/5000 (critère 5.6)", async () => {
    const res = await createExpense(repo, ctx, {
      ...baseInput,
      grossCents: 10000,
      shares: ratio5050,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.shares.map((s) => s.cents).sort()).toEqual([5000, 5000]);
  });

  it("ratio custom 70/30 sur 100€ → parts 7000/3000 (cette dépense seule)", async () => {
    const res = await createExpense(repo, ctx, {
      ...baseInput,
      grossCents: 10000,
      shares: [
        { memberId: "A", pct: 70 },
        { memberId: "B", pct: 30 },
      ],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const byMember = Object.fromEntries(res.data.shares.map((s) => [s.memberId, s.cents]));
    expect(byMember.A).toBe(7000);
    expect(byMember.B).toBe(3000);
  });
});

describe("createExpense — refus, rien n'est créé (5.6 négatifs / DoD pt.3)", () => {
  it("montant 0 → VALIDATION_ERROR, aucun insert", async () => {
    const res = await createExpense(repo, ctx, { ...baseInput, grossCents: 0, shares: ratio5050 });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("VALIDATION_ERROR");
    expect(repo.insertCount).toBe(0);
  });

  it("montant négatif → VALIDATION_ERROR, aucun insert", async () => {
    const res = await createExpense(repo, ctx, {
      ...baseInput,
      grossCents: -100,
      shares: ratio5050,
    });
    expect(res.ok).toBe(false);
    expect(repo.insertCount).toBe(0);
  });

  it("Σ pct = 90 → VALIDATION_ERROR, aucun insert", async () => {
    const res = await createExpense(repo, ctx, {
      ...baseInput,
      grossCents: 10000,
      shares: [
        { memberId: "A", pct: 60 },
        { memberId: "B", pct: 30 },
      ],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("VALIDATION_ERROR");
    expect(res.error.field).toBe("shares");
    expect(repo.insertCount).toBe(0);
  });

  it("payeur hors foyer → VALIDATION_ERROR (payerId), aucun insert", async () => {
    const res = await createExpense(repo, ctx, {
      ...baseInput,
      grossCents: 10000,
      payerId: "Z",
      shares: ratio5050,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("VALIDATION_ERROR");
    expect(res.error.field).toBe("payerId");
    expect(repo.insertCount).toBe(0);
  });

  it("foyer non autorisé (mismatch seam) → FORBIDDEN, aucun insert", async () => {
    const res = await createExpense(repo, ctx, {
      ...baseInput,
      householdId: "AUTRE",
      grossCents: 10000,
      shares: ratio5050,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("FORBIDDEN");
    expect(repo.insertCount).toBe(0);
  });
});

describe("updateExpense — recompute & gardes (4.6 / ch.7)", () => {
  it("changer le montant recompute les parts figées", async () => {
    const created = await createExpense(repo, ctx, {
      ...baseInput,
      grossCents: 10000,
      shares: ratio5050,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const res = await updateExpense(repo, ctx, {
      expenseId: created.data.id,
      patch: { grossCents: 20000 },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.grossCents).toBe(20000);
    expect(res.data.shares.map((s) => s.cents).sort()).toEqual([10000, 10000]);
  });

  it("id inconnu → NOT_FOUND", async () => {
    const res = await updateExpense(repo, ctx, { expenseId: "nope", patch: { label: "X" } });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("NOT_FOUND");
  });

  it("dépense rattachée à un settlement → EXPENSE_LOCKED", async () => {
    repo.seed({
      id: "locked-1",
      householdId: HOUSEHOLD,
      label: "Loyer",
      category: "loyer",
      grossCents: 80000,
      payerId: "A",
      incurredOn: "2026-06-04",
      source: "manual",
      settlementId: "settle-1",
      createdAt: "2026-06-04T10:00:00.000Z",
      updatedAt: "2026-06-04T10:00:00.000Z",
      shares: [
        { memberId: "A", cents: 40000, pctSnapshot: 50 },
        { memberId: "B", cents: 40000, pctSnapshot: 50 },
      ],
      aids: [],
      deletedAt: null,
    });
    const res = await updateExpense(repo, ctx, {
      expenseId: "locked-1",
      patch: { grossCents: 90000 },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("EXPENSE_LOCKED");
  });
});

describe("deleteExpense — soft delete (D2)", () => {
  it("supprime (soft) et renvoie l'id ; la dépense sort de l'historique", async () => {
    const created = await createExpense(repo, ctx, {
      ...baseInput,
      grossCents: 10000,
      shares: ratio5050,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const del = await deleteExpense(repo, ctx, { expenseId: created.data.id });
    expect(del.ok).toBe(true);
    if (!del.ok) return;
    expect(del.data.id).toBe(created.data.id);

    const list = await listExpenses(repo, ctx);
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.find((e) => e.id === created.data.id)).toBeUndefined();
  });

  it("id inconnu → NOT_FOUND", async () => {
    const res = await deleteExpense(repo, ctx, { expenseId: "nope" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("NOT_FOUND");
  });
});

describe("listExpenses — historique chronologique filtrable (6.2)", () => {
  beforeEach(async () => {
    await createExpense(repo, ctx, {
      ...baseInput,
      label: "Loyer",
      category: "loyer",
      grossCents: 80000,
      incurredOn: "2026-07-01",
      shares: ratio5050,
    });
    await createExpense(repo, ctx, {
      ...baseInput,
      label: "Courses",
      category: "courses",
      grossCents: 5000,
      incurredOn: "2026-07-20",
      shares: ratio5050,
    });
    await createExpense(repo, ctx, {
      ...baseInput,
      label: "Resto",
      category: "sorties",
      grossCents: 4000,
      incurredOn: "2026-06-15",
      shares: ratio5050,
    });
  });

  it("renvoie tout, du plus récent au plus ancien", async () => {
    const res = await listExpenses(repo, ctx);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.map((e) => e.incurredOn)).toEqual(["2026-07-20", "2026-07-01", "2026-06-15"]);
  });

  it("filtre par mois", async () => {
    const res = await listExpenses(repo, ctx, { month: "2026-07" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.map((e) => e.label)).toEqual(["Courses", "Loyer"]);
  });

  it("filtre par catégorie", async () => {
    const res = await listExpenses(repo, ctx, { category: "sorties" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toHaveLength(1);
    expect(res.data[0].label).toBe("Resto");
  });
});
