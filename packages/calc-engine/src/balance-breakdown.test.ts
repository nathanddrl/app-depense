import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computePaidBreakdown } from "./balance-breakdown";
import type { PaidExpenseInput } from "./balance-breakdown";

describe("computePaidBreakdown — décomposition « ce qui a été payé » (écran donut)", () => {
  it("regroupe par membre puis par catégorie, triés par montant décroissant", () => {
    const expenses: PaidExpenseInput[] = [
      {
        id: "1",
        label: "Loyer",
        category: "loyer",
        grossCents: 80000,
        payerId: "A",
        incurredOn: "2026-03-01",
      },
      {
        id: "2",
        label: "Courses",
        category: "courses",
        grossCents: 6000,
        payerId: "A",
        incurredOn: "2026-03-01",
      },
      {
        id: "3",
        label: "Pain",
        category: "courses",
        grossCents: 300,
        payerId: "A",
        incurredOn: "2026-03-01",
      },
      {
        id: "4",
        label: "Ciné",
        category: "sorties",
        payerId: "B",
        grossCents: 2000,
        incurredOn: "2026-03-01",
      },
    ];

    const result = computePaidBreakdown(expenses, ["A", "B"]);

    expect(result).toHaveLength(2);
    const a = result.find((m) => m.memberId === "A")!;
    expect(a.totalCents).toBe(80000 + 6000 + 300);
    expect(a.categories.map((c) => c.category)).toEqual(["loyer", "courses"]);
    const courses = a.categories.find((c) => c.category === "courses")!;
    expect(courses.totalCents).toBe(6300);
    expect(courses.expenses.map((e) => e.label)).toEqual(["Courses", "Pain"]);

    const b = result.find((m) => m.memberId === "B")!;
    expect(b.totalCents).toBe(2000);
    expect(b.categories).toEqual([
      {
        category: "sorties",
        totalCents: 2000,
        expenses: [{ id: "4", label: "Ciné", cents: 2000, incurredOn: "2026-03-01" }],
      },
    ]);
  });

  it("membre sans dépense sur la période → total 0, aucune catégorie", () => {
    const result = computePaidBreakdown([], ["A", "B"]);
    expect(result).toEqual([
      { memberId: "A", totalCents: 0, categories: [] },
      { memberId: "B", totalCents: 0, categories: [] },
    ]);
  });

  it("égalité de montant départagée par libellé (déterminisme, stabilité de l'animation)", () => {
    const expenses: PaidExpenseInput[] = [
      {
        id: "1",
        label: "Zoo",
        category: "sorties",
        grossCents: 1000,
        payerId: "A",
        incurredOn: "2026-03-01",
      },
      {
        id: "2",
        label: "Aquarium",
        category: "sorties",
        grossCents: 1000,
        payerId: "A",
        incurredOn: "2026-03-01",
      },
    ];
    const result = computePaidBreakdown(expenses, ["A"]);
    expect(result[0].categories[0].expenses.map((e) => e.label)).toEqual(["Aquarium", "Zoo"]);
  });

  it("payeur hors foyer (défensif) → ignoré sans planter", () => {
    const expenses: PaidExpenseInput[] = [
      {
        id: "1",
        label: "Fantôme",
        category: "autre",
        grossCents: 500,
        payerId: "X",
        incurredOn: "2026-03-01",
      },
    ];
    const result = computePaidBreakdown(expenses, ["A", "B"]);
    expect(result.reduce((s, m) => s + m.totalCents, 0)).toBe(0);
  });
});

describe("PROPERTY — invariants de computePaidBreakdown (DoD refonte solde)", () => {
  it("Σ des catégories d'un membre = son total, Σ des membres = Σ des dépenses actives", () => {
    const expenseArb = fc.record({
      id: fc.uuid(),
      label: fc.string({ minLength: 1, maxLength: 20 }),
      category: fc.constantFrom("loyer", "courses", "charges", "sorties", "autre"),
      grossCents: fc.integer({ min: 1, max: 1_000_000 }),
      payerIdx: fc.integer({ min: 0, max: 1 }),
    });

    fc.assert(
      fc.property(fc.array(expenseArb, { maxLength: 30 }), (rows) => {
        const memberIds = ["A", "B"];
        const expenses: PaidExpenseInput[] = rows.map((r) => ({
          id: r.id,
          label: r.label,
          category: r.category,
          grossCents: r.grossCents,
          payerId: memberIds[r.payerIdx],
          incurredOn: "2026-03-01",
        }));

        const result = computePaidBreakdown(expenses, memberIds);

        for (const member of result) {
          const sumCategories = member.categories.reduce((s, c) => s + c.totalCents, 0);
          expect(sumCategories).toBe(member.totalCents);
          for (const category of member.categories) {
            const sumExpenses = category.expenses.reduce((s, e) => s + e.cents, 0);
            expect(sumExpenses).toBe(category.totalCents);
          }
        }

        const grandTotal = result.reduce((s, m) => s + m.totalCents, 0);
        const expectedTotal = expenses.reduce((s, e) => s + e.grossCents, 0);
        expect(grandTotal).toBe(expectedTotal);
      }),
      { numRuns: 500 },
    );
  });
});
