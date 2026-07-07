import { describe, it, expect } from "vitest";
import { adminUpdateExpense, updateExpense } from "./index";
import type {
  ExpenseRepository,
  ExpenseScalarPatch,
  NewExpense,
  StoredExpense,
} from "./repository";
import type { Expense, ExpenseContext, ExpenseShareDTO, ListExpensesFilters } from "./types";

class FakeExpenseRepository implements ExpenseRepository {
  private store = new Map<string, StoredExpense>();

  constructor(private readonly membersByHousehold: Record<string, string[]>) {}

  /** Injecte une dépense stockée arbitraire (ex. verrouillée) pour les tests. */
  seed(expense: StoredExpense): void {
    this.store.set(expense.id, expense);
  }

  async getHouseholdMemberIds(householdId: string): Promise<string[]> {
    return this.membersByHousehold[householdId] ?? [];
  }

  async getExpenseById(expenseId: string): Promise<StoredExpense | null> {
    return this.store.get(expenseId) ?? null;
  }

  async updateExpenseWithShares(
    expenseId: string,
    patch: ExpenseScalarPatch,
    shares: ExpenseShareDTO[],
  ): Promise<Expense> {
    const current = this.store.get(expenseId);
    if (!current) throw new Error("test: updateExpenseWithShares sur id inconnu");
    const updated: StoredExpense = {
      ...current,
      ...patch,
      shares,
      updatedAt: "2026-07-06T10:00:00.000Z",
    };
    this.store.set(expenseId, updated);
    return this.strip(updated);
  }

  async insertExpenseWithShares(_expense: NewExpense, _shares: ExpenseShareDTO[]): Promise<Expense> {
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
  async listExpensesForBalance(): Promise<never[]> {
    throw new Error("non utilisé par ces tests");
  }

  private strip(e: StoredExpense): Expense {
    const { deletedAt: _deletedAt, ...rest } = e;
    return rest;
  }
}

const HOUSEHOLD = "H";
const adminCtx: ExpenseContext = { memberId: "A", householdId: HOUSEHOLD, role: "admin" };
const memberCtx: ExpenseContext = { memberId: "A", householdId: HOUSEHOLD, role: "member" };

function seedLockedExpense(repo: FakeExpenseRepository, id = "locked-1"): void {
  repo.seed({
    id,
    householdId: HOUSEHOLD,
    label: "Loyer",
    category: "loyer",
    grossCents: 80000,
    payerId: "A",
    incurredOn: "2026-06-04",
    source: "manual",
    settlementId: "settle-1",
    createdAt: "2026-06-04T10:00:00.000Z",
    updatedAt: "2026-06-04T10:00:00.000Z",
    shares: [
      { memberId: "A", cents: 40000, pctSnapshot: 50 },
      { memberId: "B", cents: 40000, pctSnapshot: 50 },
    ],
    aids: [],
    deletedAt: null,
  });
}

describe("adminUpdateExpense — correction admin d'une dépense verrouillée (T-C8.3, DA14)", () => {
  it("non-admin (role member) → FORBIDDEN, aucune écriture", async () => {
    const repo = new FakeExpenseRepository({ [HOUSEHOLD]: ["A", "B"] });
    seedLockedExpense(repo);

    const res = await adminUpdateExpense(repo, memberCtx, {
      expenseId: "locked-1",
      patch: { grossCents: 90000 },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("FORBIDDEN");

    const unchanged = await repo.getExpenseById("locked-1");
    expect(unchanged?.grossCents).toBe(80000);
  });

  it("ctx.role absent → FORBIDDEN", async () => {
    const repo = new FakeExpenseRepository({ [HOUSEHOLD]: ["A", "B"] });
    seedLockedExpense(repo);
    const noRoleCtx: ExpenseContext = { memberId: "A", householdId: HOUSEHOLD };

    const res = await adminUpdateExpense(repo, noRoleCtx, {
      expenseId: "locked-1",
      patch: { grossCents: 90000 },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("FORBIDDEN");
  });

  it("dépense verrouillée + admin → correction appliquée, parts recalculées", async () => {
    const repo = new FakeExpenseRepository({ [HOUSEHOLD]: ["A", "B"] });
    seedLockedExpense(repo);

    const res = await adminUpdateExpense(repo, adminCtx, {
      expenseId: "locked-1",
      patch: { grossCents: 100000 },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.grossCents).toBe(100000);
    expect(res.data.shares.map((s) => s.cents).sort()).toEqual([50000, 50000]);
    // Le verrou lui-même n'est pas levé par la correction, juste contourné.
    expect(res.data.settlementId).toBe("settle-1");
  });

  it("non-régression : la MÊME dépense verrouillée via updateExpense classique reste EXPENSE_LOCKED", async () => {
    const repo = new FakeExpenseRepository({ [HOUSEHOLD]: ["A", "B"] });
    seedLockedExpense(repo);

    // Même après l'ajout du bypass admin, le chemin normal (même par un compte
    // admin passant par updateExpense) refuse toujours la dépense verrouillée.
    const res = await updateExpense(repo, adminCtx, {
      expenseId: "locked-1",
      patch: { grossCents: 90000 },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("EXPENSE_LOCKED");
  });

  it("id inconnu → NOT_FOUND", async () => {
    const repo = new FakeExpenseRepository({ [HOUSEHOLD]: ["A", "B"] });
    const res = await adminUpdateExpense(repo, adminCtx, {
      expenseId: "nope",
      patch: { label: "X" },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("NOT_FOUND");
  });

  it("foyer non autorisé (mismatch seam) → NOT_FOUND", async () => {
    const repo = new FakeExpenseRepository({ [HOUSEHOLD]: ["A", "B"], AUTRE: ["C", "D"] });
    seedLockedExpense(repo);
    const otherHouseholdCtx: ExpenseContext = { memberId: "C", householdId: "AUTRE", role: "admin" };

    const res = await adminUpdateExpense(repo, otherHouseholdCtx, {
      expenseId: "locked-1",
      patch: { grossCents: 90000 },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("NOT_FOUND");
  });

  it("validation de forme toujours appliquée (montant ≤ 0) → VALIDATION_ERROR", async () => {
    const repo = new FakeExpenseRepository({ [HOUSEHOLD]: ["A", "B"] });
    seedLockedExpense(repo);

    const res = await adminUpdateExpense(repo, adminCtx, {
      expenseId: "locked-1",
      patch: { grossCents: -100 },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("VALIDATION_ERROR");
  });

  it("payeur hors foyer → VALIDATION_ERROR (validation contextuelle toujours appliquée)", async () => {
    const repo = new FakeExpenseRepository({ [HOUSEHOLD]: ["A", "B"] });
    seedLockedExpense(repo);

    const res = await adminUpdateExpense(repo, adminCtx, {
      expenseId: "locked-1",
      patch: { payerId: "intrus" },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("VALIDATION_ERROR");
  });
});
