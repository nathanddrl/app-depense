import { describe, it, expect } from "vitest";
import { computeBalance, computeBalanceStatement, computeExpense } from "./index";
import type { AidInput, SettlementForBalance, SharePct, StatementExpense } from "./index";

const ratio5050: SharePct[] = [
  { memberId: "A", pct: 50 },
  { memberId: "B", pct: 50 },
];

/** Construit une dépense de relevé via le pipeline canonique (parts figées). */
function expense(
  grossCents: number,
  payerId: string,
  ratio: SharePct[] = ratio5050,
  aids: AidInput[] = [],
): StatementExpense {
  const c = computeExpense({ grossCents, payerId, ratio, aids });
  return {
    grossCents,
    payerId,
    ratio,
    shares: c.shares.map((s) => ({ memberId: s.memberId, cents: s.cents })),
    effectiveAids: c.effectiveAids,
  };
}

function statementAndBalance(
  memberId: string,
  expenses: StatementExpense[],
  settlements: SettlementForBalance[] = [],
) {
  return {
    statement: computeBalanceStatement({ memberId, expenses, settlements }),
    balance: computeBalance(expenses, ["A", "B"], settlements)[memberId],
  };
}

describe("computeBalanceStatement — relevé dépenses / aides / versements", () => {
  it("sans aide ni versement : tout tient dans la ligne dépenses", () => {
    const { statement, balance } = statementAndBalance("A", [expense(10000, "A")]);
    expect(statement).toMatchObject({
      paidCents: 10000,
      grossShareCents: 5000,
      expensesCents: 5000,
      aidsCents: 0,
      settlementsCents: 0,
      totalCents: 5000,
    });
    expect(statement.totalCents).toBe(balance);
  });

  it("loyer 800 € payé par A, APL 200 € perçue par A : la moitié de l'aide revient à B", () => {
    const { statement, balance } = statementAndBalance("A", [
      expense(80000, "A", ratio5050, [{ beneficiaryId: "A", amountCents: 20000 }]),
    ]);
    expect(statement.expensesCents).toBe(40000);
    expect(statement.aidReceivedCents).toBe(20000);
    expect(statement.aidOtherCents).toBe(0);
    expect(statement.aidsCents).toBe(-10000);
    expect(statement.totalCents).toBe(30000);
    expect(statement.totalCents).toBe(balance);
  });

  it("même loyer, APL perçue par B : l'écart en faveur de A grandit", () => {
    const { statement, balance } = statementAndBalance("A", [
      expense(80000, "A", ratio5050, [{ beneficiaryId: "B", amountCents: 20000 }]),
    ]);
    expect(statement.aidOtherCents).toBe(20000);
    expect(statement.aidsCents).toBe(10000);
    expect(statement.totalCents).toBe(50000);
    expect(statement.totalCents).toBe(balance);
  });

  it("ratio 70/30, point de vue du non-payeur", () => {
    const ratio: SharePct[] = [
      { memberId: "A", pct: 70 },
      { memberId: "B", pct: 30 },
    ];
    const { statement, balance } = statementAndBalance("B", [expense(10001, "A", ratio)]);
    expect(statement.paidCents).toBe(0);
    expect(statement.grossShareCents).toBe(3000);
    expect(statement.expensesCents).toBe(-3000);
    expect(statement.totalCents).toBe(balance);
  });

  it("aide > charge (plafonnée) : la somme reste exacte", () => {
    const { statement, balance } = statementAndBalance("A", [
      expense(5000, "A", ratio5050, [{ beneficiaryId: "A", amountCents: 9000 }]),
    ]);
    expect(statement.aidReceivedCents).toBe(5000);
    expect(statement.totalCents).toBe(balance);
  });

  it("versement partiel confirmé : ligne versements, les autres statuts sont ignorés", () => {
    const settlements: SettlementForBalance[] = [
      { fromMemberId: "B", toMemberId: "A", amountCents: 2000, status: "confirmed" },
      { fromMemberId: "B", toMemberId: "A", amountCents: 999, status: "pending" },
      { fromMemberId: "B", toMemberId: "A", amountCents: 999, status: "cancelled" },
    ];
    const a = statementAndBalance("A", [expense(10000, "A")], settlements);
    expect(a.statement.settlementsCents).toBe(-2000);
    expect(a.statement.totalCents).toBe(3000);
    expect(a.statement.totalCents).toBe(a.balance);

    const b = statementAndBalance("B", [expense(10000, "A")], settlements);
    expect(b.statement.settlementsCents).toBe(2000);
    expect(b.statement.totalCents).toBe(-3000);
    expect(b.statement.totalCents).toBe(b.balance);
  });

  it("corrections après règlement : ligne dédiée, comptée dans le total", () => {
    const statement = computeBalanceStatement({
      memberId: "A",
      expenses: [expense(10000, "A")],
      settlements: [],
      corrections: [
        { A: -5000, B: 5000 },
        { A: 1200, B: -1200 },
      ],
    });
    expect(statement.correctionsCents).toBe(-3800);
    expect(statement.totalCents).toBe(5000 - 3800);
  });

  it("une dépense supprimée ne compte pas", () => {
    const deleted = { ...expense(10000, "A"), deletedAt: "2026-10-01T00:00:00Z" };
    const { statement } = statementAndBalance("A", [deleted]);
    expect(statement.totalCents).toBe(0);
    expect(statement.paidCents).toBe(0);
  });
});
