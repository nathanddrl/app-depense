import { describe, it, expect } from "vitest";
import { getBalance } from "./index";
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

// ── FakeExpenseRepository : ne porte que ce dont getBalance a besoin (DA11,
// tests légers). Les autres méthodes du port sont hors périmètre ici. ──────────
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

describe("getBalance — lecture du solde courant (6.2 / 4.2)", () => {
  it("loyer 800€ payé A 50/50, APL 200€ perçue A → B doit 300€ à A", async () => {
    // Parts figées reflétant le net post-aide (60000), comme le ferait le domaine
    // au moment de la persistance : 30000/30000.
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
          source: "manual",
        },
      ],
    );

    const res = await getBalance(repo, ctx, { householdId: HOUSEHOLD });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({ from: "B", to: "A", amountCents: 30000 });
  });

  it("même cas, APL perçue B → B doit 500€ à A", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [
        {
          label: "Loyer",
          grossCents: 80000,
          payerId: "A",
          shares: ratio5050Shares(60000),
          aids: [{ beneficiaryId: "B", amountCents: 20000, label: "APL" }],
          settlementStatus: null,
          source: "manual",
        },
      ],
    );

    const res = await getBalance(repo, ctx, { householdId: HOUSEHOLD });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({ from: "B", to: "A", amountCents: 50000 });
  });

  it("plusieurs dépenses → Σ solde(A) + solde(B) = 0 (invariant, câblage)", async () => {
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
          source: "manual",
        },
        {
          label: "Courses",
          grossCents: 6000,
          payerId: "B",
          shares: ratio5050Shares(6000),
          aids: [],
          settlementStatus: null,
          source: "manual",
        },
      ],
    );

    const res = await getBalance(repo, ctx, { householdId: HOUSEHOLD });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // 40000 (A créditeur du loyer) − 3000 (B créditeur des courses) = 37000
    expect(res.data).toEqual({ from: "B", to: "A", amountCents: 37000 });
  });

  it("dépense rattachée à un settlement pending → compte encore, pendingSettlement: true", async () => {
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
          source: "manual",
        },
      ],
    );

    const res = await getBalance(repo, ctx, { householdId: HOUSEHOLD });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({ from: "B", to: "A", amountCents: 40000, pendingSettlement: true });
  });

  it("dépense rattachée à un settlement confirmed → exclue du solde (0)", async () => {
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
          source: "manual",
        },
      ],
    );

    const res = await getBalance(repo, ctx, { householdId: HOUSEHOLD });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({ from: "A", to: "B", amountCents: 0 });
  });

  it("foyer non autorisé (mismatch seam) → FORBIDDEN", async () => {
    const repo = new FakeExpenseRepository(["A", "B"], []);
    const res = await getBalance(repo, ctx, { householdId: "AUTRE" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("FORBIDDEN");
  });

  it("aide 900€ sur charge 800€ (T-C5.2 / 4.4) → solde nul, aucun solde aberrant", async () => {
    // Les parts figées sont déjà à 0 (recomputées à l'ajout de l'aide, T-C5.1) ;
    // getBalance ne fait que relire les aides effectives post-plafond (4.4).
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
          source: "manual",
        },
      ],
    );

    const res = await getBalance(repo, ctx, { householdId: HOUSEHOLD });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({ from: "A", to: "B", amountCents: 0 });
  });
});
