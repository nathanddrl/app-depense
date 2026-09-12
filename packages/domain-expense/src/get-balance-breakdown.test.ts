import { describe, it, expect } from "vitest";
import { getBalanceBreakdown } from "./index";
import type {
  ExpenseRepository,
  ExpenseScalarPatch,
  NewExpense,
  StoredExpense,
} from "./repository";
import type {
  BalanceExpenseRow,
  Expense,
  ExpenseContext,
  ExpenseShareDTO,
  ListExpensesFilters,
} from "./types";

class FakeExpenseRepository implements ExpenseRepository {
  constructor(
    private readonly memberIds: string[],
    private readonly expenses: Expense[],
  ) {}

  async getHouseholdMemberIds(): Promise<string[]> {
    return this.memberIds;
  }
  async listExpenses(_householdId: string, _filters: ListExpensesFilters): Promise<Expense[]> {
    return this.expenses;
  }
  async listExpensesForBalance(): Promise<BalanceExpenseRow[]> {
    throw new Error("non utilisé par ces tests");
  }
  async insertExpenseWithShares(
    _expense: NewExpense,
    _shares: ExpenseShareDTO[],
  ): Promise<Expense> {
    throw new Error("non utilisé par ces tests");
  }
  async getExpenseById(_expenseId: string): Promise<StoredExpense | null> {
    throw new Error("non utilisé par ces tests");
  }
  async updateExpenseWithShares(
    _expenseId: string,
    _patch: ExpenseScalarPatch,
    _shares: ExpenseShareDTO[],
  ): Promise<Expense> {
    throw new Error("non utilisé par ces tests");
  }
  async softDeleteExpense(_expenseId: string): Promise<{ id: string }> {
    throw new Error("non utilisé par ces tests");
  }
  async listExpenseMonths(_householdId: string): Promise<string[]> {
    throw new Error("non utilisé par ces tests");
  }
  async listAllExpensesForAdmin(): Promise<StoredExpense[]> {
    throw new Error("non utilisé par ces tests");
  }
}

const HOUSEHOLD = "H";
const ctx: ExpenseContext = { memberId: "A", householdId: HOUSEHOLD };

function expense(overrides: Partial<Expense> & Pick<Expense, "id" | "label">): Expense {
  return {
    householdId: HOUSEHOLD,
    category: "autre",
    grossCents: 1000,
    payerId: "A",
    incurredOn: "2026-01-01",
    source: "manual",
    settlementId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    shares: [],
    aids: [],
    ...overrides,
  };
}

describe("getBalanceBreakdown — décomposition « ce qui a été payé » (écran donut)", () => {
  it("regroupe les dépenses actives par membre puis par catégorie", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [
        expense({ id: "1", label: "Loyer", category: "loyer", grossCents: 80000, payerId: "A" }),
        expense({ id: "2", label: "Ciné", category: "sorties", grossCents: 2000, payerId: "B" }),
      ],
    );

    const res = await getBalanceBreakdown(repo, ctx, { householdId: HOUSEHOLD });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const a = res.data.find((m) => m.memberId === "A")!;
    expect(a.totalCents).toBe(80000);
    expect(a.categories).toEqual([
      {
        category: "loyer",
        totalCents: 80000,
        expenses: [{ id: "1", label: "Loyer", cents: 80000 }],
      },
    ]);
  });

  it("dépense future (incurredOn > today) exclue", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [expense({ id: "1", label: "Loyer futur", incurredOn: "2026-08-04", grossCents: 50000 })],
    );

    const res = await getBalanceBreakdown(repo, ctx, {
      householdId: HOUSEHOLD,
      today: "2026-07-16",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.reduce((s, m) => s + m.totalCents, 0)).toBe(0);
  });

  it("periodStart exclut tout ce qui est daté à ou avant cette date (depuis la dernière régularisation)", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [
        expense({ id: "1", label: "Avant réglement", incurredOn: "2026-06-01", grossCents: 5000 }),
        expense({ id: "2", label: "Le jour même", incurredOn: "2026-06-15", grossCents: 3000 }),
        expense({ id: "3", label: "Après réglement", incurredOn: "2026-06-16", grossCents: 7000 }),
      ],
    );

    const res = await getBalanceBreakdown(repo, ctx, {
      householdId: HOUSEHOLD,
      periodStart: "2026-06-15",
      today: "2026-07-01",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const total = res.data.reduce((s, m) => s + m.totalCents, 0);
    expect(total).toBe(7000);
  });

  it("foyer sans dépense sur la période → membres présents, totaux à 0", async () => {
    const repo = new FakeExpenseRepository(["A", "B"], []);
    const res = await getBalanceBreakdown(repo, ctx, { householdId: HOUSEHOLD });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual([
      { memberId: "A", totalCents: 0, categories: [] },
      { memberId: "B", totalCents: 0, categories: [] },
    ]);
  });

  it("foyer non autorisé (mismatch seam) → FORBIDDEN", async () => {
    const repo = new FakeExpenseRepository(["A", "B"], []);
    const res = await getBalanceBreakdown(repo, ctx, { householdId: "AUTRE" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("FORBIDDEN");
  });
});
