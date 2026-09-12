import { describe, it, expect } from "vitest";
import { findPeriodStart } from "./index";
import type {
  ExpenseRepository,
  ExpenseScalarPatch,
  NewExpense,
  StoredExpense,
} from "./repository";
import type {
  BalanceExpenseRow,
  ConfirmedSettlementForPeriod,
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

function expense(overrides: Partial<Expense> & Pick<Expense, "id" | "incurredOn">): Expense {
  return {
    householdId: HOUSEHOLD,
    label: "Dépense",
    category: "autre",
    grossCents: 10000,
    payerId: "A",
    source: "manual",
    settlementId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    shares: [
      { memberId: "A", cents: 5000, pctSnapshot: 50 },
      { memberId: "B", cents: 5000, pctSnapshot: 50 },
    ],
    aids: [],
    ...overrides,
  };
}

describe("findPeriodStart — borne de période cohérente avec le solde (refonte donut)", () => {
  it("aucun règlement confirmé → depuis le début (null)", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [expense({ id: "1", incurredOn: "2026-01-01" })],
    );
    const res = await findPeriodStart(repo, ctx, { householdId: HOUSEHOLD, settlements: [] });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toBeNull();
  });

  it("règlement qui ramène réellement le solde à 0 → sa date devient la borne", async () => {
    // A paie 10000, parts 50/50 → B doit 5000 à A. Un règlement B→A de 5000
    // à cette date exacte ramène le solde à 0.
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [expense({ id: "1", incurredOn: "2026-01-01" })],
    );
    const settlements: ConfirmedSettlementForPeriod[] = [
      {
        fromMemberId: "B",
        toMemberId: "A",
        amountCents: 5000,
        confirmedAt: "2026-01-15T00:00:00.000Z",
      },
    ];
    const res = await findPeriodStart(repo, ctx, { householdId: HOUSEHOLD, settlements });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toBe("2026-01-15");
  });

  it("règlement PARTIEL (ne ramène pas à 0) → reste depuis le début, pas la date du règlement", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [expense({ id: "1", incurredOn: "2026-01-01" })],
    );
    const settlements: ConfirmedSettlementForPeriod[] = [
      {
        fromMemberId: "B",
        toMemberId: "A",
        amountCents: 2000,
        confirmedAt: "2026-01-15T00:00:00.000Z",
      },
    ];
    const res = await findPeriodStart(repo, ctx, { householdId: HOUSEHOLD, settlements });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toBeNull();
  });

  it("règlement qui solde tout, puis nouvelle dette avec règlement partiel plus récent → garde la 1re date (la seule vraie remise à zéro)", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [
        expense({ id: "1", incurredOn: "2026-01-01" }),
        expense({ id: "2", incurredOn: "2026-02-01" }),
      ],
    );
    const settlements: ConfirmedSettlementForPeriod[] = [
      {
        fromMemberId: "B",
        toMemberId: "A",
        amountCents: 5000,
        confirmedAt: "2026-01-15T00:00:00.000Z",
      },
      {
        fromMemberId: "B",
        toMemberId: "A",
        amountCents: 1000,
        confirmedAt: "2026-02-15T00:00:00.000Z",
      },
    ];
    const res = await findPeriodStart(repo, ctx, { householdId: HOUSEHOLD, settlements });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toBe("2026-01-15");
  });

  it("deux règlements qui soldent tout chacun leur tour → garde le plus récent", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [
        expense({ id: "1", incurredOn: "2026-01-01" }),
        expense({ id: "2", incurredOn: "2026-02-01" }),
      ],
    );
    const settlements: ConfirmedSettlementForPeriod[] = [
      {
        fromMemberId: "B",
        toMemberId: "A",
        amountCents: 5000,
        confirmedAt: "2026-01-15T00:00:00.000Z",
      },
      {
        fromMemberId: "B",
        toMemberId: "A",
        amountCents: 5000,
        confirmedAt: "2026-02-15T00:00:00.000Z",
      },
    ];
    const res = await findPeriodStart(repo, ctx, { householdId: HOUSEHOLD, settlements });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toBe("2026-02-15");
  });

  it("foyer non autorisé (mismatch seam) → FORBIDDEN", async () => {
    const repo = new FakeExpenseRepository(["A", "B"], []);
    const res = await findPeriodStart(repo, ctx, { householdId: "AUTRE", settlements: [] });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("FORBIDDEN");
  });
});
