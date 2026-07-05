import { describe, it, expect } from "vitest";
import { computeExpenseBreakdown } from "./index";
import type { LabelledAidInput } from "./index";

const ratio5050 = [
  { memberId: "A", pct: 50 },
  { memberId: "B", pct: 50 },
];

describe("computeExpenseBreakdown — décomposition en deux temps (spec 8.3)", () => {
  it("loyer 800€ payé A 50/50, APL 200€ perçue A → 1er temps 400, 2e temps -100, total 300", () => {
    const aids: LabelledAidInput[] = [{ beneficiaryId: "A", amountCents: 20000, label: "APL" }];
    const breakdown = computeExpenseBreakdown({
      grossCents: 80000,
      payerId: "A",
      ratio: ratio5050,
      aids,
    });

    expect(breakdown.payerId).toBe("A");
    expect(breakdown.otherId).toBe("B");
    expect(breakdown.baseOwedCents).toBe(40000);
    expect(breakdown.aidLines).toEqual([
      { label: "APL", beneficiaryId: "A", aidCents: 20000, sharedCents: 10000 },
    ]);
    expect(breakdown.totalOwedCents).toBe(30000);
  });

  it("même cas, APL perçue par B (non-payeur) → total 500 (symétrique, cf. balance.test.ts)", () => {
    const aids: LabelledAidInput[] = [{ beneficiaryId: "B", amountCents: 20000, label: "APL" }];
    const breakdown = computeExpenseBreakdown({
      grossCents: 80000,
      payerId: "A",
      ratio: ratio5050,
      aids,
    });

    expect(breakdown.baseOwedCents).toBe(40000);
    expect(breakdown.aidLines).toEqual([
      { label: "APL", beneficiaryId: "B", aidCents: 20000, sharedCents: 10000 },
    ]);
    expect(breakdown.totalOwedCents).toBe(50000);
  });

  it("sans aide → total = 1er temps seul", () => {
    const breakdown = computeExpenseBreakdown({
      grossCents: 80000,
      payerId: "A",
      ratio: ratio5050,
      aids: [],
    });
    expect(breakdown.baseOwedCents).toBe(40000);
    expect(breakdown.aidLines).toEqual([]);
    expect(breakdown.totalOwedCents).toBe(40000);
  });

  it("ratio custom 70/30, payeur B → décomposition cohérente avec le payeur non-A", () => {
    const breakdown = computeExpenseBreakdown({
      grossCents: 10000,
      payerId: "B",
      ratio: [
        { memberId: "A", pct: 70 },
        { memberId: "B", pct: 30 },
      ],
      aids: [],
    });
    expect(breakdown.payerId).toBe("B");
    expect(breakdown.otherId).toBe("A");
    expect(breakdown.baseOwedCents).toBe(7000); // A doit sa part (70%) à B
    expect(breakdown.totalOwedCents).toBe(7000);
  });

  it("ratio à 2 entrées obligatoire → CalcPreconditionError sinon", () => {
    expect(() =>
      computeExpenseBreakdown({
        grossCents: 10000,
        payerId: "A",
        ratio: [{ memberId: "A", pct: 100 }],
        aids: [],
      }),
    ).toThrow();
  });
});
