import { describe, it, expect } from "vitest";
import { getAdminExpenseOverview } from "./index";
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
    private readonly rows: StoredExpense[],
  ) {}

  async getHouseholdMemberIds(): Promise<string[]> {
    return this.memberIds;
  }
  async listAllExpensesForAdmin(): Promise<StoredExpense[]> {
    return this.rows;
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
  async listExpenses(_householdId: string, _filters: ListExpensesFilters): Promise<Expense[]> {
    throw new Error("non utilisé par ces tests");
  }
}

const HOUSEHOLD = "H";
const adminCtx: ExpenseContext = { memberId: "A", householdId: HOUSEHOLD, role: "admin" };
const ratio5050 = [
  { memberId: "A", cents: 0, pctSnapshot: 50 },
  { memberId: "B", cents: 0, pctSnapshot: 50 },
];

function makeStoredExpense(overrides: Partial<StoredExpense>): StoredExpense {
  return {
    id: "exp-1",
    householdId: HOUSEHOLD,
    label: "Loyer",
    category: "loyer",
    grossCents: 80000,
    payerId: "A",
    incurredOn: "2026-07-01",
    source: "manual",
    settlementId: null,
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
    shares: ratio5050,
    aids: [],
    deletedAt: null,
    ...overrides,
  };
}

describe("getAdminExpenseOverview — vue admin brute (T-C8.2, DA14)", () => {
  it("non-admin (role absent ou member) → FORBIDDEN, aucune lecture du repo", async () => {
    const repo = new FakeExpenseRepository(["A", "B"], [makeStoredExpense({})]);
    const memberCtx: ExpenseContext = { memberId: "A", householdId: HOUSEHOLD, role: "member" };

    const res = await getAdminExpenseOverview(repo, memberCtx, { householdId: HOUSEHOLD });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("FORBIDDEN");
  });

  it("ctx.role absent → FORBIDDEN", async () => {
    const repo = new FakeExpenseRepository(["A", "B"], []);
    const noRoleCtx: ExpenseContext = { memberId: "A", householdId: HOUSEHOLD };

    const res = await getAdminExpenseOverview(repo, noRoleCtx, { householdId: HOUSEHOLD });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("FORBIDDEN");
  });

  it("foyer non autorisé (mismatch seam) → FORBIDDEN", async () => {
    const repo = new FakeExpenseRepository(["A", "B"], []);
    const res = await getAdminExpenseOverview(repo, adminCtx, { householdId: "AUTRE" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("FORBIDDEN");
  });

  it("dépense verrouillée (settlementId non nul) → incluse, avec décomposition", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [makeStoredExpense({ id: "exp-locked", settlementId: "settlement-1" })],
    );

    const res = await getAdminExpenseOverview(repo, adminCtx, { householdId: HOUSEHOLD });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toHaveLength(1);
    expect(res.data[0]).toMatchObject({
      id: "exp-locked",
      settlementId: "settlement-1",
      deletedAt: null,
      baseOwedCents: 40000,
      totalOwedCents: 40000,
    });
  });

  it("dépense soft-supprimée (deletedAt non nul) → incluse, avec décomposition", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [makeStoredExpense({ id: "exp-deleted", deletedAt: "2026-07-05T00:00:00.000Z" })],
    );

    const res = await getAdminExpenseOverview(repo, adminCtx, { householdId: HOUSEHOLD });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toHaveLength(1);
    expect(res.data[0]).toMatchObject({
      id: "exp-deleted",
      deletedAt: "2026-07-05T00:00:00.000Z",
      settlementId: null,
    });
  });

  it("mix actives/verrouillées/supprimées → toutes présentes, une ligne chacune", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [
        makeStoredExpense({ id: "exp-active" }),
        makeStoredExpense({ id: "exp-locked", settlementId: "settlement-1" }),
        makeStoredExpense({ id: "exp-deleted", deletedAt: "2026-07-05T00:00:00.000Z" }),
      ],
    );

    const res = await getAdminExpenseOverview(repo, adminCtx, { householdId: HOUSEHOLD });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.map((l) => l.id)).toEqual(["exp-active", "exp-locked", "exp-deleted"]);
  });

  it("aide 200€ perçue par le payeur, brut 800€ 50/50 → base 400, aide part 100, total 300", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [
        makeStoredExpense({
          aids: [{ id: "aid-1", beneficiaryId: "A", amountCents: 20000, label: "APL" }],
        }),
      ],
    );

    const res = await getAdminExpenseOverview(repo, adminCtx, { householdId: HOUSEHOLD });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual([
      {
        id: "exp-1",
        label: "Loyer",
        category: "loyer",
        incurredOn: "2026-07-01",
        grossCents: 80000,
        payerId: "A",
        otherId: "B",
        settlementId: null,
        deletedAt: null,
        baseOwedCents: 40000,
        aidLines: [{ label: "APL", beneficiaryId: "A", aidCents: 20000, sharedCents: 10000 }],
        totalOwedCents: 30000,
      },
    ]);
  });
});
