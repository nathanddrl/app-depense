import { describe, it, expect } from "vitest";
import { getSettlementCorrections } from "./index";
import type {
  ExpenseRepository,
  ExpenseScalarPatch,
  NewExpense,
  StoredExpense,
} from "./repository";
import type {
  BalanceExpenseRow,
  PeriodStart,
  Expense,
  ExpenseContext,
  ExpenseShareDTO,
  ListExpensesFilters,
} from "./types";

class FakeExpenseRepository implements ExpenseRepository {
  constructor(
    private readonly memberIds: string[],
    private readonly expenses: (Expense & { deletedAt?: string | null })[],
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
    return this.expenses.map((e) => ({ deletedAt: null, ...e }));
  }
}

const HOUSEHOLD = "H";
const ctx: ExpenseContext = { memberId: "A", householdId: HOUSEHOLD };

function expense(
  overrides: Partial<StoredExpense> & Pick<Expense, "id" | "incurredOn">,
): StoredExpense {
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
    deletedAt: null,
    ...overrides,
  };
}

const periodStart: PeriodStart = { date: "2026-01-15", settledAt: "2026-01-15T12:00:00.000Z" };

async function corrections(expenses: StoredExpense[], today = "2026-02-01") {
  const repo = new FakeExpenseRepository(["A", "B"], expenses);
  const res = await getSettlementCorrections(repo, ctx, {
    householdId: HOUSEHOLD,
    periodStart,
    today,
  });
  expect(res.ok).toBe(true);
  if (!res.ok) throw new Error("inattendu");
  return res.data;
}

describe("getSettlementCorrections — corrections après la régularisation", () => {
  it("aucune correction → liste vide", async () => {
    expect(await corrections([expense({ id: "1", incurredOn: "2026-01-01" })])).toEqual([]);
  });

  it("dépense couverte supprimée après → « deleted », le payeur perd sa créance", async () => {
    const lines = await corrections([
      expense({ id: "1", incurredOn: "2026-01-02", deletedAt: "2026-01-15T12:02:00.000Z" }),
    ]);
    expect(lines).toEqual([
      {
        expenseId: "1",
        label: "Dépense",
        incurredOn: "2026-01-02",
        kind: "deleted",
        amountCents: 10000,
        balanceDelta: { A: -5000, B: 5000 },
      },
    ]);
  });

  it("dépense créée après mais datée d'avant (ou du jour même) → « added »", async () => {
    const lines = await corrections([
      expense({ id: "1", incurredOn: "2026-01-15", createdAt: "2026-01-19T06:00:00.000Z" }),
    ]);
    expect(lines.map((l) => [l.kind, l.balanceDelta])).toEqual([["added", { A: 5000, B: -5000 }]]);
  });

  it("aide ajoutée après sur une dépense couverte → « aid-added », montant = l'aide", async () => {
    const lines = await corrections([
      expense({
        id: "1",
        incurredOn: "2026-01-05",
        aids: [
          {
            id: "aid-1",
            beneficiaryId: "A",
            label: "APL",
            amountCents: 3000,
            createdAt: "2026-01-18T00:00:00.000Z",
          },
        ],
      }),
    ]);
    expect(lines.map((l) => [l.kind, l.amountCents, l.balanceDelta])).toEqual([
      ["aid-added", 3000, { A: -1500, B: 1500 }],
    ]);
  });

  it("montant modifié après (historisé) → « modified », ancien et nouveau montant", async () => {
    const lines = await corrections([
      expense({
        id: "1",
        incurredOn: "2026-01-05",
        grossCents: 12000,
        shares: [
          { memberId: "A", cents: 6000, pctSnapshot: 50 },
          { memberId: "B", cents: 6000, pctSnapshot: 50 },
        ],
        revisions: [
          {
            replacedAt: "2026-01-20T00:00:00.000Z",
            label: "Dépense",
            category: "autre",
            grossCents: 10000,
            payerId: "A",
            incurredOn: "2026-01-05",
            shares: [
              { memberId: "A", cents: 5000, pctSnapshot: 50 },
              { memberId: "B", cents: 5000, pctSnapshot: 50 },
            ],
            aids: [],
          },
        ],
      }),
    ]);
    expect(lines).toEqual([
      {
        expenseId: "1",
        label: "Dépense",
        incurredOn: "2026-01-05",
        kind: "modified",
        amountCents: 12000,
        previousAmountCents: 10000,
        balanceDelta: { A: 1000, B: -1000 },
      },
    ]);
  });

  it("aide retirée après (historisée) → « modified », l'aide perdue revient dans l'écart", async () => {
    const lines = await corrections([
      expense({
        id: "1",
        incurredOn: "2026-01-05",
        revisions: [
          {
            replacedAt: "2026-01-20T00:00:00.000Z",
            label: "Dépense",
            category: "autre",
            grossCents: 10000,
            payerId: "A",
            incurredOn: "2026-01-05",
            shares: [
              { memberId: "A", cents: 4000, pctSnapshot: 50 },
              { memberId: "B", cents: 4000, pctSnapshot: 50 },
            ],
            aids: [
              {
                id: "aid-1",
                beneficiaryId: "A",
                label: "APL",
                amountCents: 2000,
                createdAt: "2026-01-02T00:00:00.000Z",
              },
            ],
          },
        ],
      }),
    ]);
    expect(lines.map((l) => [l.kind, l.previousAmountCents, l.balanceDelta])).toEqual([
      ["modified", undefined, { A: 1000, B: -1000 }],
    ]);
  });

  it("dépense couverte redatée après le règlement → sort de la fenêtre, vue comme retirée", async () => {
    const lines = await corrections([
      expense({
        id: "1",
        incurredOn: "2026-01-20",
        revisions: [
          {
            replacedAt: "2026-01-21T00:00:00.000Z",
            label: "Dépense",
            category: "autre",
            grossCents: 10000,
            payerId: "A",
            incurredOn: "2026-01-05",
            shares: [
              { memberId: "A", cents: 5000, pctSnapshot: 50 },
              { memberId: "B", cents: 5000, pctSnapshot: 50 },
            ],
            aids: [],
          },
        ],
      }),
    ]);
    expect(lines.map((l) => [l.kind, l.balanceDelta])).toEqual([
      ["deleted", { A: -5000, B: 5000 }],
    ]);
  });

  it("ignore : dépenses postérieures (déjà dans le donut), créées puis supprimées après, et déjà supprimées avant", async () => {
    const lines = await corrections([
      expense({ id: "1", incurredOn: "2026-01-20", createdAt: "2026-01-20T00:00:00.000Z" }),
      expense({
        id: "2",
        incurredOn: "2026-01-10",
        createdAt: "2026-01-16T00:00:00.000Z",
        deletedAt: "2026-01-17T00:00:00.000Z",
      }),
      expense({ id: "3", incurredOn: "2026-01-10", deletedAt: "2026-01-12T00:00:00.000Z" }),
    ]);
    expect(lines).toEqual([]);
  });

  it("foyer non autorisé (mismatch seam) → FORBIDDEN", async () => {
    const repo = new FakeExpenseRepository(["A", "B"], []);
    const res = await getSettlementCorrections(repo, ctx, { householdId: "AUTRE", periodStart });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("FORBIDDEN");
  });
});
