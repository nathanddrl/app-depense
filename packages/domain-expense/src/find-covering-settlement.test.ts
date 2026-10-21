import { describe, it, expect } from "vitest";
import { findCoveringSettlement } from "./index";
import type { ExpenseRepository, StoredExpense } from "./repository";
import type { ConfirmedSettlementForPeriod, ExpenseContext } from "./types";

const HOUSEHOLD = "H";
const ctx: ExpenseContext = { memberId: "A", householdId: HOUSEHOLD };

function repoWith(expense: StoredExpense | null): ExpenseRepository {
  const unused = () => {
    throw new Error("non utilisé par ces tests");
  };
  return {
    getExpenseById: async () => expense,
    getHouseholdMemberIds: unused,
    insertExpenseWithShares: unused,
    updateExpenseWithShares: unused,
    softDeleteExpense: unused,
    listExpenses: unused,
    listExpenseMonths: unused,
    listExpensesForBalance: unused,
    listAllExpensesForAdmin: unused,
  };
}

function expense(overrides: Partial<StoredExpense> = {}): StoredExpense {
  return {
    id: "1",
    householdId: HOUSEHOLD,
    label: "Courses",
    category: "courses",
    grossCents: 4000,
    payerId: "A",
    incurredOn: "2026-10-03",
    source: "manual",
    settlementId: null,
    createdAt: "2026-10-03T08:00:00.000Z",
    updatedAt: "2026-10-03T08:00:00.000Z",
    shares: [
      { memberId: "A", cents: 2000, pctSnapshot: 50 },
      { memberId: "B", cents: 2000, pctSnapshot: 50 },
    ],
    aids: [],
    deletedAt: null,
    ...overrides,
  };
}

const settlement = (confirmedAt: string): ConfirmedSettlementForPeriod => ({
  fromMemberId: "B",
  toMemberId: "A",
  amountCents: 1000,
  confirmedAt,
});

describe("findCoveringSettlement — avertir avant de corriger une dépense déjà réglée", () => {
  it("dépense connue et datée avant le dernier règlement → couverte", async () => {
    const res = await findCoveringSettlement(repoWith(expense()), ctx, {
      expenseId: "1",
      settlements: [settlement("2026-09-01T10:00:00.000Z"), settlement("2026-10-04T13:16:34.000Z")],
    });
    expect(res).toEqual({
      ok: true,
      data: { date: "2026-10-04", settledAt: "2026-10-04T13:16:34.000Z" },
    });
  });

  it("dépense saisie après le règlement (même datée d'avant) → pas couverte", async () => {
    const res = await findCoveringSettlement(
      repoWith(expense({ createdAt: "2026-10-05T08:00:00.000Z" })),
      ctx,
      { expenseId: "1", settlements: [settlement("2026-10-04T13:16:34.000Z")] },
    );
    expect(res).toEqual({ ok: true, data: null });
  });

  it("dépense datée après le règlement, ou aucun règlement → pas couverte", async () => {
    const later = await findCoveringSettlement(
      repoWith(expense({ incurredOn: "2026-10-10" })),
      ctx,
      { expenseId: "1", settlements: [settlement("2026-10-04T13:16:34.000Z")] },
    );
    expect(later).toEqual({ ok: true, data: null });
    const none = await findCoveringSettlement(repoWith(expense()), ctx, {
      expenseId: "1",
      settlements: [],
    });
    expect(none).toEqual({ ok: true, data: null });
  });

  it("dépense d'un autre foyer → NOT_FOUND", async () => {
    const res = await findCoveringSettlement(repoWith(expense({ householdId: "AUTRE" })), ctx, {
      expenseId: "1",
      settlements: [],
    });
    expect(res.ok).toBe(false);
  });
});
