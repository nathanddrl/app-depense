// Suite d'intégration — machine à états régularisation (spec §5.6, T-C6.5).
//
// Ne recode AUCUNE logique métier : elle prouve que `@app/domain-expense`
// (getBalance/updateExpense/deleteExpense) et `@app/domain-settlement`
// (initiateSettlement/confirmSettlement/cancelSettlement) tiennent ensemble
// bout en bout, sur un état partagé, une seule fois — chose que les tests
// unitaires de chaque package NE PEUVENT PAS prouver : la garde ESLint
// anti-cross-domain (ch.1.4/DA4) interdit à un package `domain-*` d'importer
// un autre `domain-*`, y compris dans ses propres tests. `apps/web` n'a pas
// cette restriction (seule la garde « API publique » s'applique) : c'est ici,
// et seulement ici, que la composition peut être exercée en clair — exactement
// le rôle que jouera la future Server Action (composition getBalance →
// initiateSettlement décrite en T-C6.2).
//
// Les critères unitaires (validations individuelles de chaque action, formes
// des erreurs) restent couverts dans les suites de `domain-settlement` et
// `domain-expense` — pas dupliqués ici.

import { describe, it, expect } from "vitest";
import { getBalance, updateExpense, deleteExpense } from "@app/domain-expense";
import type {
  BalanceExpenseRow,
  Category,
  Expense,
  ExpenseContext,
  ExpenseRepository,
  ExpenseScalarPatch,
  StoredExpense,
} from "@app/domain-expense";
import { initiateSettlement, confirmSettlement, cancelSettlement } from "@app/domain-settlement";
import type {
  NewSettlement,
  Settlement,
  SettlementContext,
  SettlementRepository,
} from "@app/domain-settlement";

// ── État partagé unique (un foyer, deux membres) entre les deux fakes ──────
type Store = {
  memberIds: Record<string, string[]>;
  expenses: Map<string, StoredExpense>;
  settlements: Map<string, Settlement>;
};

function makeStore(): Store {
  return { memberIds: { [HOUSEHOLD]: ["A", "B"] }, expenses: new Map(), settlements: new Map() };
}

function strip(e: StoredExpense): Expense {
  const { deletedAt: _deletedAt, ...rest } = e;
  return rest;
}

class FakeExpenseRepository implements ExpenseRepository {
  constructor(private readonly store: Store) {}

  async getHouseholdMemberIds(householdId: string): Promise<string[]> {
    return this.store.memberIds[householdId] ?? [];
  }

  async getExpenseById(expenseId: string): Promise<StoredExpense | null> {
    return this.store.expenses.get(expenseId) ?? null;
  }

  async updateExpenseWithShares(
    expenseId: string,
    patch: ExpenseScalarPatch,
    shares: StoredExpense["shares"],
  ): Promise<Expense> {
    const current = this.store.expenses.get(expenseId);
    if (!current) throw new Error("test: expense inconnue");
    const updated: StoredExpense = {
      ...current,
      ...patch,
      shares,
      updatedAt: new Date().toISOString(),
    };
    this.store.expenses.set(expenseId, updated);
    return strip(updated);
  }

  async softDeleteExpense(expenseId: string): Promise<{ id: string }> {
    const current = this.store.expenses.get(expenseId);
    if (!current) throw new Error("test: expense inconnue");
    this.store.expenses.set(expenseId, { ...current, deletedAt: new Date().toISOString() });
    return { id: expenseId };
  }

  async listExpensesForBalance(householdId: string): Promise<BalanceExpenseRow[]> {
    return [...this.store.expenses.values()]
      .filter((e) => e.householdId === householdId && e.deletedAt === null)
      .map((e) => ({
        label: e.label,
        grossCents: e.grossCents,
        payerId: e.payerId,
        shares: e.shares,
        aids: e.aids,
        settlementStatus: e.settlementId
          ? (this.store.settlements.get(e.settlementId)?.status ?? null)
          : null,
      }));
  }

  async insertExpenseWithShares(): Promise<Expense> {
    throw new Error("non utilisé par cette suite d'intégration");
  }
  async listExpenses(): Promise<Expense[]> {
    throw new Error("non utilisé par cette suite d'intégration");
  }
  async listAllExpensesForAdmin(): Promise<StoredExpense[]> {
    throw new Error("non utilisé par cette suite d'intégration");
  }
}

class FakeSettlementRepository implements SettlementRepository {
  constructor(private readonly store: Store) {}

  async getPendingSettlement(householdId: string): Promise<{ id: string } | null> {
    for (const s of this.store.settlements.values()) {
      if (s.householdId === householdId && s.status === "pending") return { id: s.id };
    }
    return null;
  }

  async createSettlementAndFreezeExpenses(newSettlement: NewSettlement): Promise<Settlement> {
    const id = `settlement-${this.store.settlements.size + 1}`;
    const settlement: Settlement = {
      id,
      householdId: newSettlement.householdId,
      status: "pending",
      amountCents: newSettlement.amountCents,
      fromMemberId: newSettlement.fromMemberId,
      toMemberId: newSettlement.toMemberId,
      initiatedBy: newSettlement.initiatedBy,
      initiatedAt: new Date().toISOString(),
      confirmedBy: null,
      confirmedAt: null,
      cancelledAt: null,
    };
    this.store.settlements.set(id, settlement);
    for (const [expenseId, expense] of this.store.expenses) {
      if (
        expense.householdId === newSettlement.householdId &&
        expense.deletedAt === null &&
        expense.settlementId === null
      ) {
        this.store.expenses.set(expenseId, { ...expense, settlementId: id });
      }
    }
    return settlement;
  }

  async getSettlementById(settlementId: string): Promise<Settlement | null> {
    return this.store.settlements.get(settlementId) ?? null;
  }

  async confirmSettlement(settlementId: string, confirmedBy: string): Promise<Settlement> {
    const existing = this.store.settlements.get(settlementId);
    if (!existing) throw new Error("test: settlement inconnu");
    const updated: Settlement = {
      ...existing,
      status: "confirmed",
      confirmedBy,
      confirmedAt: new Date().toISOString(),
    };
    this.store.settlements.set(settlementId, updated);
    return updated;
  }

  async cancelSettlement(settlementId: string): Promise<Settlement> {
    const existing = this.store.settlements.get(settlementId);
    if (!existing) throw new Error("test: settlement inconnu");
    const updated: Settlement = {
      ...existing,
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    };
    this.store.settlements.set(settlementId, updated);
    for (const [expenseId, expense] of this.store.expenses) {
      if (expense.settlementId === settlementId) {
        this.store.expenses.set(expenseId, { ...expense, settlementId: null });
      }
    }
    return updated;
  }
}

const HOUSEHOLD = "H";
const CATEGORY: Category = "loyer";
const ctxA: ExpenseContext & SettlementContext = { memberId: "A", householdId: HOUSEHOLD };
const ctxB: ExpenseContext & SettlementContext = { memberId: "B", householdId: HOUSEHOLD };

/** A paie 600 €, split 50/50 → B doit 300 € à A (scénario réaliste unique). */
function seedRentExpense(store: Store): void {
  store.expenses.set("exp-1", {
    id: "exp-1",
    householdId: HOUSEHOLD,
    label: "Loyer",
    category: CATEGORY,
    grossCents: 60000,
    payerId: "A",
    incurredOn: "2026-07-01",
    source: "manual",
    settlementId: null,
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
    shares: [
      { memberId: "A", cents: 30000, pctSnapshot: 50 },
      { memberId: "B", cents: 30000, pctSnapshot: 50 },
    ],
    aids: [],
    deletedAt: null,
  });
}

describe("machine à états régularisation — intégration bout en bout (spec §5.6)", () => {
  it("pending → confirmed : solde affiché pendant pending, figé à 0 après confirmation, dépense immuable", async () => {
    const store = makeStore();
    seedRentExpense(store);
    const expenseRepo = new FakeExpenseRepository(store);
    const settlementRepo = new FakeSettlementRepository(store);

    // Solde initial : B doit 300 € à A.
    const before = await getBalance(expenseRepo, ctxB, { householdId: HOUSEHOLD });
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.data).toMatchObject({ from: "B", to: "A", amountCents: 30000 });

    // Le débiteur déclenche, en réutilisant le solde tel quel (composition
    // Server Action getBalance → initiateSettlement, T-C6.2).
    const initiated = await initiateSettlement(settlementRepo, ctxB, {
      householdId: HOUSEHOLD,
      fromMemberId: before.data.from,
      toMemberId: before.data.to,
      amountCents: before.data.amountCents,
    });
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) return;
    expect(initiated.data.status).toBe("pending");
    const settlementId = initiated.data.id;

    // Le solde reste affiché à l'identique tant que `pending` (§4.2).
    const duringPending = await getBalance(expenseRepo, ctxB, { householdId: HOUSEHOLD });
    expect(duringPending.ok).toBe(true);
    if (!duringPending.ok) return;
    expect(duringPending.data).toMatchObject({
      from: "B",
      to: "A",
      amountCents: 30000,
      pendingSettlement: true,
    });

    // L'initiateur (débiteur) ne peut pas s'auto-confirmer.
    const selfConfirm = await confirmSettlement(settlementRepo, ctxB, { settlementId });
    expect(selfConfirm.ok).toBe(false);
    if (selfConfirm.ok) return;
    expect(selfConfirm.error.code).toBe("FORBIDDEN");

    // Une seule régularisation pending par foyer.
    const secondInitiate = await initiateSettlement(settlementRepo, ctxB, {
      householdId: HOUSEHOLD,
      fromMemberId: "B",
      toMemberId: "A",
      amountCents: 30000,
    });
    expect(secondInitiate.ok).toBe(false);
    if (secondInitiate.ok) return;
    expect(secondInitiate.error.code).toBe("SETTLEMENT_PENDING_EXISTS");

    // La dépense gelée refuse toute édition, même pendant `pending`.
    const editWhilePending = await updateExpense(expenseRepo, ctxA, {
      expenseId: "exp-1",
      patch: { grossCents: 70000 },
    });
    expect(editWhilePending.ok).toBe(false);
    if (editWhilePending.ok) return;
    expect(editWhilePending.error.code).toBe("EXPENSE_LOCKED");

    // Le créancier confirme.
    const confirmed = await confirmSettlement(settlementRepo, ctxA, { settlementId });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.data.status).toBe("confirmed");
    expect(confirmed.data.confirmedBy).toBe("A");

    // Le solde est désormais figé à 0 (dépense exclue, settlement confirmed).
    const afterConfirm = await getBalance(expenseRepo, ctxA, { householdId: HOUSEHOLD });
    expect(afterConfirm.ok).toBe(true);
    if (!afterConfirm.ok) return;
    expect(afterConfirm.data.amountCents).toBe(0);

    // La dépense reste définitivement immuable (édition ET suppression).
    const editAfterConfirm = await updateExpense(expenseRepo, ctxA, {
      expenseId: "exp-1",
      patch: { grossCents: 70000 },
    });
    expect(editAfterConfirm.ok).toBe(false);
    if (editAfterConfirm.ok) return;
    expect(editAfterConfirm.error.code).toBe("EXPENSE_LOCKED");

    const deleteAfterConfirm = await deleteExpense(expenseRepo, ctxA, { expenseId: "exp-1" });
    expect(deleteAfterConfirm.ok).toBe(false);
    if (deleteAfterConfirm.ok) return;
    expect(deleteAfterConfirm.error.code).toBe("EXPENSE_LOCKED");
  });

  it("pending → cancelled : dépense rouverte, solde inchangé", async () => {
    const store = makeStore();
    seedRentExpense(store);
    const expenseRepo = new FakeExpenseRepository(store);
    const settlementRepo = new FakeSettlementRepository(store);

    const before = await getBalance(expenseRepo, ctxB, { householdId: HOUSEHOLD });
    expect(before.ok).toBe(true);
    if (!before.ok) return;

    const initiated = await initiateSettlement(settlementRepo, ctxB, {
      householdId: HOUSEHOLD,
      fromMemberId: before.data.from,
      toMemberId: before.data.to,
      amountCents: before.data.amountCents,
    });
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) return;

    // Le créancier refuse (annulation possible par le créancier OU l'initiateur, T-C6.3).
    const cancelled = await cancelSettlement(settlementRepo, ctxA, {
      settlementId: initiated.data.id,
    });
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;
    expect(cancelled.data.status).toBe("cancelled");

    // La dépense est dé-stampée : elle se rouvre (édition à nouveau possible).
    const reopened = await expenseRepo.getExpenseById("exp-1");
    expect(reopened?.settlementId).toBeNull();

    const editAfterCancel = await updateExpense(expenseRepo, ctxA, {
      expenseId: "exp-1",
      patch: { grossCents: 60000 },
    });
    expect(editAfterCancel.ok).toBe(true);

    // Le solde est inchangé : rien n'a jamais été soustrait tant que non confirmé.
    const afterCancel = await getBalance(expenseRepo, ctxB, { householdId: HOUSEHOLD });
    expect(afterCancel.ok).toBe(true);
    if (!afterCancel.ok) return;
    expect(afterCancel.data).toMatchObject({ from: "B", to: "A", amountCents: 30000 });
  });

  it("solde nul → BALANCE_ALREADY_ZERO (aucune dépense ouverte dans le foyer)", async () => {
    const store = makeStore();
    const expenseRepo = new FakeExpenseRepository(store);
    const settlementRepo = new FakeSettlementRepository(store);

    const balance = await getBalance(expenseRepo, ctxB, { householdId: HOUSEHOLD });
    expect(balance.ok).toBe(true);
    if (!balance.ok) return;
    expect(balance.data.amountCents).toBe(0);

    const initiated = await initiateSettlement(settlementRepo, ctxB, {
      householdId: HOUSEHOLD,
      fromMemberId: balance.data.from,
      toMemberId: balance.data.to,
      amountCents: balance.data.amountCents,
    });
    expect(initiated.ok).toBe(false);
    if (initiated.ok) return;
    expect(initiated.error.code).toBe("BALANCE_ALREADY_ZERO");
  });
});
