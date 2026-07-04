import { describe, it, expect } from "vitest";
import { computeExpense, contribution, computeBalance, reduceBalanceTwoMembers } from "./index";
import type { BalanceExpense, ExpenseInput } from "./index";

const ratio5050 = [
  { memberId: "A", pct: 50 },
  { memberId: "B", pct: 50 },
];

// Assemble une BalanceExpense à partir du pipeline réel (usage nominal du moteur).
function balanceExpense(
  input: ExpenseInput,
  meta: Pick<BalanceExpense, "deletedAt" | "settlementConfirmed"> = {},
): BalanceExpense {
  const c = computeExpense(input);
  return {
    grossCents: input.grossCents,
    payerId: input.payerId,
    shares: c.shares.map((s) => ({ memberId: s.memberId, cents: s.cents })),
    effectiveAids: c.effectiveAids,
    ...meta,
  };
}

describe("solde — contribution & réconciliation payeur/répartiteur (4.2 / annexe A)", () => {
  it("loyer 800€ payé A, 50/50, sans aide → B doit 400€ à A", () => {
    const expenses = [balanceExpense({ grossCents: 80000, payerId: "A", ratio: ratio5050 })];
    const bal = computeBalance(expenses, ["A", "B"]);
    expect(bal.A).toBe(40000);
    expect(bal.B).toBe(-40000);
    expect(reduceBalanceTwoMembers(bal)).toEqual({ from: "B", to: "A", amountCents: 40000 });
  });

  it("+ APL 200€ bénéf. A → B doit 300€ à A (exemple de référence, annexe A)", () => {
    const expenses = [
      balanceExpense({
        grossCents: 80000,
        payerId: "A",
        ratio: ratio5050,
        aids: [{ beneficiaryId: "A", amountCents: 20000 }],
      }),
    ];
    const bal = computeBalance(expenses, ["A", "B"]);
    expect(bal.A).toBe(30000);
    expect(bal.B).toBe(-30000);
    expect(reduceBalanceTwoMembers(bal)).toEqual({ from: "B", to: "A", amountCents: 30000 });
  });

  it("+ APL 200€ bénéf. B → B doit 500€ à A (contre-exemple structurant)", () => {
    const expenses = [
      balanceExpense({
        grossCents: 80000,
        payerId: "A",
        ratio: ratio5050,
        aids: [{ beneficiaryId: "B", amountCents: 20000 }],
      }),
    ];
    const bal = computeBalance(expenses, ["A", "B"]);
    expect(bal.A).toBe(50000);
    expect(bal.B).toBe(-50000);
    expect(reduceBalanceTwoMembers(bal)).toEqual({ from: "B", to: "A", amountCents: 50000 });
  });

  it("contribution(m) = payé − aide_perçue − part, par membre", () => {
    const e = balanceExpense({
      grossCents: 80000,
      payerId: "A",
      ratio: ratio5050,
      aids: [{ beneficiaryId: "B", amountCents: 20000 }],
    });
    expect(contribution(e, "A")).toBe(80000 - 0 - 30000); // +50000
    expect(contribution(e, "B")).toBe(0 - 20000 - 30000); // -50000
  });

  it("aide > charge → net 0, aucun solde aberrant, Σ solde = 0", () => {
    const e = balanceExpense({
      grossCents: 80000,
      payerId: "A",
      ratio: ratio5050,
      aids: [{ beneficiaryId: "A", amountCents: 90000 }],
    });
    const bal = computeBalance([e], ["A", "B"]);
    // A a payé 80000 et perçu 80000 (plafonné), part 0 → 0 ; B rien → 0.
    expect(bal.A).toBe(0);
    expect(bal.B).toBe(0);
    expect(reduceBalanceTwoMembers(bal)).toBeNull();
  });

  it("plusieurs dépenses s'additionnent dans le solde", () => {
    const expenses = [
      balanceExpense({ grossCents: 80000, payerId: "A", ratio: ratio5050 }), // B -40000
      balanceExpense({ grossCents: 6000, payerId: "B", ratio: ratio5050 }), // A -3000
    ];
    const bal = computeBalance(expenses, ["A", "B"]);
    expect(bal.A).toBe(40000 - 3000); // +37000
    expect(bal.B).toBe(-40000 + 3000); // -37000
    expect(reduceBalanceTwoMembers(bal)).toEqual({ from: "B", to: "A", amountCents: 37000 });
  });
});

describe("filtre du solde (4.2) — supprimé / régularisé confirmé", () => {
  const base = { grossCents: 80000, payerId: "A", ratio: ratio5050 } as const;

  it("dépense soft-deletée exclue du solde", () => {
    const expenses = [balanceExpense(base, { deletedAt: new Date() })];
    const bal = computeBalance(expenses, ["A", "B"]);
    expect(bal.A).toBe(0);
    expect(bal.B).toBe(0);
  });

  it("settlement confirmé exclut la dépense (solde → 0)", () => {
    const expenses = [balanceExpense(base, { settlementConfirmed: true })];
    const bal = computeBalance(expenses, ["A", "B"]);
    expect(bal.A).toBe(0);
    expect(bal.B).toBe(0);
  });

  it("settlement pending (non confirmé) → la dette reste comptée", () => {
    const expenses = [balanceExpense(base, { settlementConfirmed: false })];
    const bal = computeBalance(expenses, ["A", "B"]);
    expect(bal.A).toBe(40000);
    expect(bal.B).toBe(-40000);
  });
});

describe("reduceBalanceTwoMembers", () => {
  it("solde nul → null", () => {
    expect(reduceBalanceTwoMembers({ A: 0, B: 0 })).toBeNull();
  });

  it("oriente from = débiteur (solde négatif), to = créancier (solde positif)", () => {
    expect(reduceBalanceTwoMembers({ A: -300, B: 300 })).toEqual({
      from: "A",
      to: "B",
      amountCents: 300,
    });
  });
});
