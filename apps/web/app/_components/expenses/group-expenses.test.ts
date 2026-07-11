import { describe, it, expect } from "vitest";
import type { Expense } from "@app/domain-expense";
import { groupByDay, groupByMonth } from "./group-expenses";

function makeExpense(overrides: Partial<Expense> & { id: string; incurredOn: string }): Expense {
  return {
    householdId: "h1",
    label: "dépense",
    category: "autre",
    grossCents: 1000,
    payerId: "m1",
    source: "manual",
    settlementId: null,
    createdAt: overrides.incurredOn,
    updatedAt: overrides.incurredOn,
    shares: [],
    aids: [],
    ...overrides,
  } as Expense;
}

describe("groupByDay", () => {
  it("regroupe les dépenses consécutives partageant la même date", () => {
    const expenses = [
      makeExpense({ id: "1", incurredOn: "2026-07-09" }),
      makeExpense({ id: "2", incurredOn: "2026-07-09" }),
      makeExpense({ id: "3", incurredOn: "2026-07-08" }),
    ];

    const groups = groupByDay(expenses);

    expect(groups).toEqual([
      { key: "2026-07-09", items: [expenses[0], expenses[1]] },
      { key: "2026-07-08", items: [expenses[2]] },
    ]);
  });

  it("un seul groupe si toutes les dépenses sont sur le même jour", () => {
    const expenses = [
      makeExpense({ id: "1", incurredOn: "2026-07-09" }),
      makeExpense({ id: "2", incurredOn: "2026-07-09" }),
    ];

    expect(groupByDay(expenses)).toHaveLength(1);
  });
});

describe("groupByMonth", () => {
  it("regroupe les dépenses par mois (YYYY-MM), au-delà des jours", () => {
    const expenses = [
      makeExpense({ id: "1", incurredOn: "2026-07-20" }),
      makeExpense({ id: "2", incurredOn: "2026-07-01" }),
      makeExpense({ id: "3", incurredOn: "2026-06-15" }),
    ];

    const groups = groupByMonth(expenses);

    expect(groups).toEqual([
      { key: "2026-07", items: [expenses[0], expenses[1]] },
      { key: "2026-06", items: [expenses[2]] },
    ]);
  });

  it("distingue le même mois sur deux années différentes", () => {
    const expenses = [
      makeExpense({ id: "1", incurredOn: "2026-07-01" }),
      makeExpense({ id: "2", incurredOn: "2025-07-15" }),
    ];

    const groups = groupByMonth(expenses);

    expect(groups.map((g) => g.key)).toEqual(["2026-07", "2025-07"]);
  });
});
