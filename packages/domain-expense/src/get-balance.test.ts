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
import type { SettlementForBalance } from "@app/calc-engine";

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

describe("getBalance — lecture du solde courant (6.2 / 4.2, modèle ledger D7 révisé)", () => {
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
          incurredOn: "2026-01-01",
          shares: ratio5050Shares(60000),
          aids: [{ beneficiaryId: "A", amountCents: 20000, label: "APL" }],
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
          incurredOn: "2026-01-01",
          shares: ratio5050Shares(60000),
          aids: [{ beneficiaryId: "B", amountCents: 20000, label: "APL" }],
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
          incurredOn: "2026-01-01",
          shares: ratio5050Shares(80000),
          aids: [],
          source: "manual",
        },
        {
          label: "Courses",
          grossCents: 6000,
          payerId: "B",
          incurredOn: "2026-01-01",
          shares: ratio5050Shares(6000),
          aids: [],
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

  it("règlement confirmé partiel transmis par l'appelant → solde réduit sans être annulé", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [
        {
          label: "Loyer",
          grossCents: 80000,
          payerId: "A",
          incurredOn: "2026-01-01",
          shares: ratio5050Shares(80000),
          aids: [],
          source: "manual",
        },
      ],
    );
    const settlements: SettlementForBalance[] = [
      { fromMemberId: "B", toMemberId: "A", amountCents: 10000, status: "confirmed" },
    ];

    const res = await getBalance(repo, ctx, { householdId: HOUSEHOLD, settlements });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({ from: "B", to: "A", amountCents: 30000 });
  });

  it("règlement pending transmis par l'appelant → n'affecte pas encore le solde", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [
        {
          label: "Loyer",
          grossCents: 80000,
          payerId: "A",
          incurredOn: "2026-01-01",
          shares: ratio5050Shares(80000),
          aids: [],
          source: "manual",
        },
      ],
    );
    const settlements: SettlementForBalance[] = [
      { fromMemberId: "B", toMemberId: "A", amountCents: 10000, status: "pending" },
    ];

    const res = await getBalance(repo, ctx, { householdId: HOUSEHOLD, settlements });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({ from: "B", to: "A", amountCents: 40000 });
  });

  it("règlement confirmé total → solde nul", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [
        {
          label: "Loyer",
          grossCents: 80000,
          payerId: "A",
          incurredOn: "2026-01-01",
          shares: ratio5050Shares(80000),
          aids: [],
          source: "manual",
        },
      ],
    );
    const settlements: SettlementForBalance[] = [
      { fromMemberId: "B", toMemberId: "A", amountCents: 40000, status: "confirmed" },
    ];

    const res = await getBalance(repo, ctx, { householdId: HOUSEHOLD, settlements });
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
          incurredOn: "2026-01-01",
          shares: [
            { memberId: "A", cents: 0, pctSnapshot: 50 },
            { memberId: "B", cents: 0, pctSnapshot: 50 },
          ],
          aids: [{ beneficiaryId: "A", amountCents: 90000, label: "APL" }],
          source: "manual",
        },
      ],
    );

    const res = await getBalance(repo, ctx, { householdId: HOUSEHOLD });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({ from: "A", to: "B", amountCents: 0 });
  });

  it("règlement confirmé supérieur au solde (D15 v0.5) → solde inversé, câblage getBalance", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [
        {
          label: "Loyer",
          grossCents: 80000,
          payerId: "A",
          incurredOn: "2026-01-01",
          shares: ratio5050Shares(80000),
          aids: [],
          source: "manual",
        },
      ],
    );
    // B doit 40000 à A ; règlement confirmé de 50000 → A doit désormais 10000 à B.
    const settlements: SettlementForBalance[] = [
      { fromMemberId: "B", toMemberId: "A", amountCents: 50000, status: "confirmed" },
    ];

    const res = await getBalance(repo, ctx, { householdId: HOUSEHOLD, settlements });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({ from: "A", to: "B", amountCents: 10000 });
  });

  it("dépense future (incurredOn > today) exclue du solde", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [
        {
          label: "Loyer passé",
          grossCents: 80000,
          payerId: "A",
          incurredOn: "2026-07-01",
          shares: ratio5050Shares(80000),
          aids: [],
          source: "manual",
        },
        {
          label: "Loyer récurrent généré en avance",
          grossCents: 20000,
          payerId: "A",
          incurredOn: "2026-08-04",
          shares: ratio5050Shares(20000),
          aids: [],
          source: "recurring",
        },
      ],
    );

    const res = await getBalance(repo, ctx, { householdId: HOUSEHOLD, today: "2026-07-16" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // Seul le loyer passé compte : 40000 (B doit à A).
    expect(res.data).toEqual({ from: "B", to: "A", amountCents: 40000 });
  });

  it("bascule le jour J : incurredOn === today est compté (pas encore \"futur\")", async () => {
    const repo = new FakeExpenseRepository(
      ["A", "B"],
      [
        {
          label: "Loyer du jour",
          grossCents: 80000,
          payerId: "A",
          incurredOn: "2026-07-16",
          shares: ratio5050Shares(80000),
          aids: [],
          source: "manual",
        },
      ],
    );

    const res = await getBalance(repo, ctx, { householdId: HOUSEHOLD, today: "2026-07-16" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({ from: "B", to: "A", amountCents: 40000 });
  });
});
