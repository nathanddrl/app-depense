import { describe, it, expect } from "vitest";
import { getBalanceDetail } from "./index";
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
    private readonly rows: BalanceExpenseRow[],
  ) {}

  async getHouseholdMemberIds(): Promise<string[]> {
    return this.memberIds;
  }
  async listExpensesForBalance(): Promise<BalanceExpenseRow[]> {
    return this.rows;
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
  async listExpenses(_householdId: string, _filters: ListExpensesFilters): Promise<Expense[]> {
    throw new Error("non utilisé par ces tests");
  }
  async listAllExpensesForAdmin(): Promise<StoredExpense[]> {
    throw new Error("non utilisé par ces tests");
  }
}

const HOUSEHOLD = "H";
const ctx: ExpenseContext = { memberId: "A", householdId: HOUSEHOLD };
const ratio5050Shares = (grossCents: number) => [
  { memberId: "A", cents: grossCents / 2, pctSnapshot: 50 },
  { memberId: "B", cents: grossCents / 2, pctSnapshot: 50 },
];

describe("getBalanceDetail — décomposition en deux temps (spec 8.3 / T-C4.4)", () => {
  it("loyer 800€ payé A 50/50, APL 200€ perçue A → 1 ligne, 1er temps 400, 2e temps 100, total 300", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [
        {
          label: "Loyer",
          grossCents: 80000,
          payerId: "A",
          shares: ratio5050Shares(60000),
          aids: [{ beneficiaryId: "A", amountCents: 20000, label: "APL" }],
          settlementStatus: null,
        },
      ],
    );

    const res = await getBalanceDetail(repo, ctx, { householdId: HOUSEHOLD });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual([
      {
        label: "Loyer",
        grossCents: 80000,
        payerId: "A",
        otherId: "B",
        baseOwedCents: 40000,
        aidLines: [{ label: "APL", beneficiaryId: "A", aidCents: 20000, sharedCents: 10000 }],
        totalOwedCents: 30000,
      },
    ]);
  });

  it("plusieurs dépenses → une ligne par dépense contributive", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [
        {
          label: "Loyer",
          grossCents: 80000,
          payerId: "A",
          shares: ratio5050Shares(80000),
          aids: [],
          settlementStatus: null,
        },
        {
          label: "Courses",
          grossCents: 6000,
          payerId: "B",
          shares: ratio5050Shares(6000),
          aids: [],
          settlementStatus: null,
        },
      ],
    );

    const res = await getBalanceDetail(repo, ctx, { householdId: HOUSEHOLD });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toHaveLength(2);
    expect(res.data.map((l) => l.label)).toEqual(["Loyer", "Courses"]);
  });

  it("settlement confirmé → dépense exclue du détail", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [
        {
          label: "Loyer",
          grossCents: 80000,
          payerId: "A",
          shares: ratio5050Shares(80000),
          aids: [],
          settlementStatus: "confirmed",
        },
      ],
    );

    const res = await getBalanceDetail(repo, ctx, { householdId: HOUSEHOLD });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual([]);
  });

  it("settlement pending → dépense encore présente dans le détail", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [
        {
          label: "Loyer",
          grossCents: 80000,
          payerId: "A",
          shares: ratio5050Shares(80000),
          aids: [],
          settlementStatus: "pending",
        },
      ],
    );

    const res = await getBalanceDetail(repo, ctx, { householdId: HOUSEHOLD });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toHaveLength(1);
  });

  it("foyer non autorisé (mismatch seam) → FORBIDDEN", async () => {
    const repo = new FakeExpenseRepository(["A", "B"], []);
    const res = await getBalanceDetail(repo, ctx, { householdId: "AUTRE" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("FORBIDDEN");
  });

  it("aide 900€ sur charge 800€ (T-C5.2 / 4.4) → aide eff plafonnée à 80000, total dû 0", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [
        {
          label: "Loyer",
          grossCents: 80000,
          payerId: "A",
          shares: [
            { memberId: "A", cents: 0, pctSnapshot: 50 },
            { memberId: "B", cents: 0, pctSnapshot: 50 },
          ],
          aids: [{ beneficiaryId: "A", amountCents: 90000, label: "APL" }],
          settlementStatus: null,
        },
      ],
    );

    const res = await getBalanceDetail(repo, ctx, { householdId: HOUSEHOLD });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual([
      {
        label: "Loyer",
        grossCents: 80000,
        payerId: "A",
        otherId: "B",
        baseOwedCents: 40000,
        aidLines: [{ label: "APL", beneficiaryId: "A", aidCents: 80000, sharedCents: 40000 }],
        totalOwedCents: 0,
      },
    ]);
  });
});
