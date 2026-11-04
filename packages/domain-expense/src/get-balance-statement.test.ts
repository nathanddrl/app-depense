import { describe, it, expect } from "vitest";
import { findPeriodStart, getBalance, getBalanceStatement, signedBalanceFor } from "./index";
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
} from "./types";

// Fake repo complet en lecture : même jeu de dépenses servi par les trois
// lectures (actives, vue solde, vue admin brute), comme le repo Supabase.
class FakeExpenseRepository implements ExpenseRepository {
  constructor(
    private readonly memberIds: string[],
    private readonly expenses: StoredExpense[],
  ) {}

  private active() {
    return this.expenses.filter((e) => e.deletedAt === null);
  }
  async getHouseholdMemberIds(): Promise<string[]> {
    return this.memberIds;
  }
  async listExpenses(): Promise<Expense[]> {
    return this.active();
  }
  async listExpensesForBalance(): Promise<BalanceExpenseRow[]> {
    return this.active().map((e) => ({
      label: e.label,
      grossCents: e.grossCents,
      payerId: e.payerId,
      incurredOn: e.incurredOn,
      shares: e.shares,
      aids: e.aids,
      source: "manual",
    }));
  }
  async listAllExpensesForAdmin(): Promise<StoredExpense[]> {
    return this.expenses;
  }
  async insertExpenseWithShares(_e: NewExpense, _s: ExpenseShareDTO[]): Promise<Expense> {
    throw new Error("non utilisé");
  }
  async getExpenseById(): Promise<StoredExpense | null> {
    throw new Error("non utilisé");
  }
  async updateExpenseWithShares(
    _id: string,
    _p: ExpenseScalarPatch,
    _s: ExpenseShareDTO[],
  ): Promise<Expense> {
    throw new Error("non utilisé");
  }
  async softDeleteExpense(): Promise<{ id: string }> {
    throw new Error("non utilisé");
  }
  async listExpenseMonths(): Promise<string[]> {
    throw new Error("non utilisé");
  }
}

const HOUSEHOLD = "H";
const TODAY = "2026-03-01";

/** Dépense 50/50 ; parts figées cohérentes avec les aides (net partagé). */
function expense(
  id: string,
  incurredOn: string,
  grossCents: number,
  payerId: string,
  overrides: Partial<StoredExpense> = {},
): StoredExpense {
  const aidTotal = (overrides.aids ?? []).reduce((s, a) => s + a.amountCents, 0);
  const net = Math.max(0, grossCents - aidTotal);
  const other = payerId === "A" ? "B" : "A";
  const otherCents = Math.floor(net / 2);
  return {
    id,
    householdId: HOUSEHOLD,
    label: `dépense ${id}`,
    category: "autre",
    grossCents,
    payerId,
    incurredOn,
    source: "manual",
    settlementId: null,
    createdAt: `${incurredOn}T08:00:00.000Z`,
    updatedAt: `${incurredOn}T08:00:00.000Z`,
    shares: [
      { memberId: payerId, cents: net - otherCents, pctSnapshot: 50 },
      { memberId: other, cents: otherCents, pctSnapshot: 50 },
    ],
    aids: [],
    deletedAt: null,
    ...overrides,
  };
}

/**
 * Rejoue exactement la composition de `getBalanceBreakdownAction` et vérifie
 * l'invariant de l'écran : le total du relevé = le solde du centre, pour
 * chacun des deux membres.
 */
async function check(expenses: StoredExpense[], settlements: ConfirmedSettlementForPeriod[]) {
  const repo = new FakeExpenseRepository(["A", "B"], expenses);
  const results = [];
  for (const memberId of ["A", "B"]) {
    const ctx: ExpenseContext = { memberId, householdId: HOUSEHOLD };
    const balance = await getBalance(repo, ctx, {
      householdId: HOUSEHOLD,
      settlements: settlements.map((s) => ({ ...s, status: "confirmed" as const })),
      today: TODAY,
    });
    const period = await findPeriodStart(repo, ctx, { householdId: HOUSEHOLD, settlements });
    if (!balance.ok || !period.ok) throw new Error("inattendu");
    const res = await getBalanceStatement(repo, ctx, {
      householdId: HOUSEHOLD,
      periodStart: period.data,
      settlements,
      balance: balance.data,
      today: TODAY,
    });
    if (!res.ok) throw new Error("inattendu");
    const statement = res.data.statement;
    // Garde-fou : un relevé est toujours rendu, et son total = le solde affiché.
    expect(statement).not.toBeNull();
    if (!statement) throw new Error("inattendu");
    expect(statement.lines.totalCents).toBe(signedBalanceFor(balance.data, memberId));
    results.push(statement);
  }
  return results;
}

describe("getBalanceStatement — total du relevé = solde affiché", () => {
  it("sans règlement : période depuis le début, aides comprises", async () => {
    const [a] = await check(
      [
        expense("1", "2026-01-05", 80000, "A", {
          aids: [{ id: "x", beneficiaryId: "A", label: "APL", amountCents: 20000 }],
        }),
        expense("2", "2026-01-10", 3000, "B"),
      ],
      [],
    );
    expect(a.lines.expensesCents).toBe(40000 - 1500);
    expect(a.lines.aidsCents).toBe(-10000);
    expect(a.lines.settlementsCents).toBe(0);
    expect(a.sharePct).toBe(50);
    expect(a.aids).toEqual([
      {
        id: "1-A",
        label: "APL",
        expenseLabel: "dépense 1",
        incurredOn: "2026-01-05",
        beneficiaryId: "A",
        amountCents: 20000,
      },
    ]);
  });

  it("règlement qui remet à zéro puis versement partiel : seul le partiel apparaît", async () => {
    const [a] = await check(
      [expense("1", "2026-01-05", 10000, "A"), expense("2", "2026-02-01", 20000, "A")],
      [
        {
          fromMemberId: "B",
          toMemberId: "A",
          amountCents: 5000,
          confirmedAt: "2026-01-20T10:00:00.000Z",
        },
        {
          fromMemberId: "B",
          toMemberId: "A",
          amountCents: 4000,
          confirmedAt: "2026-02-10T10:00:00.000Z",
        },
      ],
    );
    expect(a.lines.expensesCents).toBe(10000);
    expect(a.lines.settlementsCents).toBe(-4000);
    expect(a.settlements).toHaveLength(1);
  });

  it("deux règlements le même jour : le second (après la remise à zéro) compte", async () => {
    const [a] = await check(
      [expense("1", "2026-01-05", 10000, "A")],
      [
        {
          fromMemberId: "B",
          toMemberId: "A",
          amountCents: 5000,
          confirmedAt: "2026-01-20T10:00:00.000Z",
        },
        {
          fromMemberId: "B",
          toMemberId: "A",
          amountCents: 1000,
          confirmedAt: "2026-01-20T18:00:00.000Z",
        },
      ],
    );
    // Le 2e règlement inverse l'écart : il ne remet pas à zéro, la période part du 1er.
    expect(a.lines.settlementsCents).toBe(-1000);
    expect(a.lines.totalCents).toBe(-1000);
  });

  it("dépense future exclue", async () => {
    const [a] = await check(
      [expense("1", "2026-01-05", 10000, "A"), expense("2", "2026-04-01", 9000, "A")],
      [],
    );
    expect(a.lines.paidCents).toBe(10000);
  });

  it("parts figées ≠ parts recalculées sur une dépense d'avant : l'arrondi rejoint les corrections", async () => {
    // Parts figées 5001/4999 (ancienne saisie) alors que le recalcul donne
    // 5000/5000 : le rejeu de la remise à zéro et le solde affiché divergent
    // d'1 centime, le relevé doit quand même retomber sur le solde.
    const [a] = await check(
      [
        expense("1", "2026-01-05", 10000, "A", {
          shares: [
            { memberId: "A", cents: 5001, pctSnapshot: 50 },
            { memberId: "B", cents: 4999, pctSnapshot: 50 },
          ],
        }),
        expense("2", "2026-02-01", 2000, "A"),
      ],
      [
        {
          fromMemberId: "B",
          toMemberId: "A",
          amountCents: 5000,
          confirmedAt: "2026-01-20T10:00:00.000Z",
        },
      ],
    );
    expect(a.lines.expensesCents).toBe(1000);
    expect(a.lines.correctionsCents).toBe(-1);
  });

  it("aide plafonnée : la liste montre le montant effectif, et le déclaré à part", async () => {
    const [a] = await check(
      [
        expense("1", "2026-01-05", 5000, "A", {
          aids: [{ id: "x", beneficiaryId: "A", label: "prime", amountCents: 9000 }],
        }),
      ],
      [],
    );
    expect(a.aids).toEqual([
      expect.objectContaining({ amountCents: 5000, declaredCents: 9000, label: "prime" }),
    ]);
    expect(a.lines.aidReceivedCents).toBe(5000);
  });

  it("doublon couvert supprimé après le règlement : ligne corrections", async () => {
    const [a, b] = await check(
      [
        expense("1", "2026-01-05", 10000, "A"),
        expense("2", "2026-01-06", 10000, "A", { deletedAt: "2026-01-25T09:00:00.000Z" }),
        expense("3", "2026-02-01", 2000, "B"),
      ],
      [
        {
          fromMemberId: "B",
          toMemberId: "A",
          amountCents: 10000,
          confirmedAt: "2026-01-20T10:00:00.000Z",
        },
      ],
    );
    expect(a.lines.correctionsCents).toBe(-5000);
    expect(a.lines.expensesCents).toBe(-1000);
    expect(b.lines.correctionsCents).toBe(5000);
  });
});
