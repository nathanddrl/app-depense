// Suite d'intégration — machine à états régularisation, modèle ledger (spec
// §5.6, D7/D15 révisés, T-C6.5).
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
// le rôle que joue la Server Action `actions.ts` (composition getBalance ↔
// initiateSettlement/listConfirmedSettlements, T-C6.2, D15 révisé).
//
// Modèle ledger : plus de gel des dépenses (D7 révisé) — elles restent
// éditables tout au long du cycle de vie d'un règlement, partiel ou total. Le
// solde intègre les règlements `confirmed` via `computeBalance` (calc-engine).
//
// Les critères unitaires (validations individuelles de chaque action, formes
// des erreurs) restent couverts dans les suites de `domain-settlement` et
// `domain-expense` — pas dupliqués ici.

import { describe, it, expect } from "vitest";
import { getBalance, updateExpense } from "@app/domain-expense";
import type {
  BalanceExpenseRow,
  Category,
  Expense,
  ExpenseContext,
  ExpenseSource,
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
import type { SettlementForBalance } from "@app/calc-engine";

// ── État partagé unique (un foyer, deux membres) entre les deux fakes ──────
type Store = {
  memberIds: Record<string, string[]>;
  expenses: Map<string, StoredExpense>;
  settlements: Map<string, Settlement>;
};

function toExpenseSource(source: string): ExpenseSource {
  if (source === "manual" || source === "recurring") return source;
  throw new Error(`test: source de dépense inconnue (${source})`);
}

function makeStore(): Store {
  return { memberIds: { [HOUSEHOLD]: ["A", "B"] }, expenses: new Map(), settlements: new Map() };
}

function strip(e: StoredExpense): Expense {
  const { deletedAt: _deletedAt, ...rest } = e;
  return rest;
}

/** Ajustements ledger (D7/D15 révisés) : les settlements `confirmed` du foyer,
 * transmis explicitement à `getBalance` — même composition que `actions.ts`. */
function confirmedSettlements(store: Store, householdId: string): SettlementForBalance[] {
  return [...store.settlements.values()]
    .filter((s) => s.householdId === householdId && s.status === "confirmed")
    .map((s) => ({
      fromMemberId: s.fromMemberId,
      toMemberId: s.toMemberId,
      amountCents: s.amountCents,
      status: s.status,
    }));
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
        incurredOn: e.incurredOn,
        shares: e.shares,
        aids: e.aids,
        source: toExpenseSource(e.source),
      }));
  }

  async insertExpenseWithShares(): Promise<Expense> {
    throw new Error("non utilisé par cette suite d'intégration");
  }
  async listExpenses(): Promise<Expense[]> {
    throw new Error("non utilisé par cette suite d'intégration");
  }
  async listExpenseMonths(): Promise<string[]> {
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

  // Modèle ledger (D7 révisé) : plus de gel des dépenses, création simple.
  async createSettlement(newSettlement: NewSettlement): Promise<Settlement> {
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

  // Modèle ledger (D7 révisé) : simple update de statut, plus de dé-gel.
  async cancelSettlement(settlementId: string): Promise<Settlement> {
    const existing = this.store.settlements.get(settlementId);
    if (!existing) throw new Error("test: settlement inconnu");
    const updated: Settlement = {
      ...existing,
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    };
    this.store.settlements.set(settlementId, updated);
    return updated;
  }

  async listConfirmedSettlements(householdId: string): Promise<Settlement[]> {
    return [...this.store.settlements.values()].filter(
      (s) => s.householdId === householdId && s.status === "confirmed",
    );
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

describe("machine à états régularisation — intégration bout en bout (spec §5.6, modèle ledger)", () => {
  it("pending → confirmed (total) : solde affiché pendant pending, réduit à 0 après confirmation, dépense toujours éditable", async () => {
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
    // Server Action getBalance → initiateSettlement, T-C6.2, D15 révisé).
    const initiated = await initiateSettlement(settlementRepo, ctxB, {
      householdId: HOUSEHOLD,
      fromMemberId: before.data.from,
      toMemberId: before.data.to,
      amountCents: before.data.amountCents,
      balanceAmountCents: before.data.amountCents,
    });
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) return;
    expect(initiated.data.status).toBe("pending");
    const settlementId = initiated.data.id;

    // Le solde reste affiché à l'identique tant que `pending` (§4.2) : le
    // settlement pending n'entre pas encore dans les ajustements confirmés.
    const duringPending = await getBalance(expenseRepo, ctxB, {
      householdId: HOUSEHOLD,
      settlements: confirmedSettlements(store, HOUSEHOLD),
    });
    expect(duringPending.ok).toBe(true);
    if (!duringPending.ok) return;
    expect(duringPending.data).toMatchObject({ from: "B", to: "A", amountCents: 30000 });

    // L'initiateur (débiteur) ne peut pas s'auto-confirmer.
    const selfConfirm = await confirmSettlement(settlementRepo, ctxB, { settlementId });
    expect(selfConfirm.ok).toBe(false);
    if (selfConfirm.ok) return;
    expect(selfConfirm.error.code).toBe("FORBIDDEN");

    // Une seule régularisation pending par foyer (inchangé, D16).
    const secondInitiate = await initiateSettlement(settlementRepo, ctxB, {
      householdId: HOUSEHOLD,
      fromMemberId: "B",
      toMemberId: "A",
      amountCents: 30000,
      balanceAmountCents: 30000,
    });
    expect(secondInitiate.ok).toBe(false);
    if (secondInitiate.ok) return;
    expect(secondInitiate.error.code).toBe("SETTLEMENT_PENDING_EXISTS");

    // Modèle ledger (D7 révisé) : la dépense reste éditable même pendant `pending`.
    const editWhilePending = await updateExpense(expenseRepo, ctxA, {
      expenseId: "exp-1",
      patch: { grossCents: 70000 },
    });
    expect(editWhilePending.ok).toBe(true);
    // On revient au montant initial pour ne pas fausser la suite du scénario.
    await updateExpense(expenseRepo, ctxA, { expenseId: "exp-1", patch: { grossCents: 60000 } });

    // Le créancier confirme.
    const confirmed = await confirmSettlement(settlementRepo, ctxA, { settlementId });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.data.status).toBe("confirmed");
    expect(confirmed.data.confirmedBy).toBe("A");

    // Le solde est désormais réduit à 0 (ajustement du règlement confirmé, total ici).
    const afterConfirm = await getBalance(expenseRepo, ctxA, {
      householdId: HOUSEHOLD,
      settlements: confirmedSettlements(store, HOUSEHOLD),
    });
    expect(afterConfirm.ok).toBe(true);
    if (!afterConfirm.ok) return;
    expect(afterConfirm.data.amountCents).toBe(0);

    // La dépense reste éditable après confirmation (modèle ledger, D7 révisé :
    // seul le montant du settlement confirmé est immuable, pas les dépenses).
    const editAfterConfirm = await updateExpense(expenseRepo, ctxA, {
      expenseId: "exp-1",
      patch: { grossCents: 60000 },
    });
    expect(editAfterConfirm.ok).toBe(true);
  });

  it("pending → confirmed (partiel) : solde réduit sans être annulé, reliquat correct", async () => {
    const store = makeStore();
    seedRentExpense(store);
    const expenseRepo = new FakeExpenseRepository(store);
    const settlementRepo = new FakeSettlementRepository(store);

    const before = await getBalance(expenseRepo, ctxB, { householdId: HOUSEHOLD });
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.data.amountCents).toBe(30000);

    // B rembourse 100 € sur les 300 € dus.
    const initiated = await initiateSettlement(settlementRepo, ctxB, {
      householdId: HOUSEHOLD,
      fromMemberId: before.data.from,
      toMemberId: before.data.to,
      amountCents: 10000,
      balanceAmountCents: before.data.amountCents,
    });
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) return;

    const confirmed = await confirmSettlement(settlementRepo, ctxA, {
      settlementId: initiated.data.id,
    });
    expect(confirmed.ok).toBe(true);

    const after = await getBalance(expenseRepo, ctxB, {
      householdId: HOUSEHOLD,
      settlements: confirmedSettlements(store, HOUSEHOLD),
    });
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.data).toMatchObject({ from: "B", to: "A", amountCents: 20000 });

    // Une nouvelle dépense saisie après ce règlement confirmé s'ajoute
    // immédiatement au solde restant (pas de gel, conséquence du modèle ledger).
    store.expenses.set("exp-2", {
      id: "exp-2",
      householdId: HOUSEHOLD,
      label: "Courses",
      category: "courses",
      grossCents: 4000,
      payerId: "A",
      incurredOn: "2026-07-05",
      source: "manual",
      settlementId: null,
      createdAt: "2026-07-05T10:00:00.000Z",
      updatedAt: "2026-07-05T10:00:00.000Z",
      shares: [
        { memberId: "A", cents: 2000, pctSnapshot: 50 },
        { memberId: "B", cents: 2000, pctSnapshot: 50 },
      ],
      aids: [],
      deletedAt: null,
    });
    const afterNewExpense = await getBalance(expenseRepo, ctxB, {
      householdId: HOUSEHOLD,
      settlements: confirmedSettlements(store, HOUSEHOLD),
    });
    expect(afterNewExpense.ok).toBe(true);
    if (!afterNewExpense.ok) return;
    expect(afterNewExpense.data).toMatchObject({ from: "B", to: "A", amountCents: 22000 });
  });

  it("pending → cancelled : solde inchangé, dépense jamais touchée", async () => {
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
      balanceAmountCents: before.data.amountCents,
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

    // La dépense n'a jamais été touchée (modèle ledger, D7 révisé).
    const untouched = await expenseRepo.getExpenseById("exp-1");
    expect(untouched?.settlementId).toBeNull();

    const editAfterCancel = await updateExpense(expenseRepo, ctxA, {
      expenseId: "exp-1",
      patch: { grossCents: 60000 },
    });
    expect(editAfterCancel.ok).toBe(true);

    // Le solde est inchangé : rien n'a jamais été soustrait tant que non confirmé.
    const afterCancel = await getBalance(expenseRepo, ctxB, {
      householdId: HOUSEHOLD,
      settlements: confirmedSettlements(store, HOUSEHOLD),
    });
    expect(afterCancel.ok).toBe(true);
    if (!afterCancel.ok) return;
    expect(afterCancel.data).toMatchObject({ from: "B", to: "A", amountCents: 30000 });
  });

  it("montant demandé > solde courant (D15 v0.5) → pending accepté, confirmation inverse le solde", async () => {
    const store = makeStore();
    seedRentExpense(store);
    const expenseRepo = new FakeExpenseRepository(store);
    const settlementRepo = new FakeSettlementRepository(store);

    const before = await getBalance(expenseRepo, ctxB, { householdId: HOUSEHOLD });
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.data).toMatchObject({ from: "B", to: "A", amountCents: 30000 });

    // B doit 300 € à A, B rembourse 400 € : plus de refus bloquant (D15 v0.5).
    const initiated = await initiateSettlement(settlementRepo, ctxB, {
      householdId: HOUSEHOLD,
      fromMemberId: before.data.from,
      toMemberId: before.data.to,
      amountCents: before.data.amountCents + 10000,
      balanceAmountCents: before.data.amountCents,
    });
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) return;
    expect(initiated.data.status).toBe("pending");
    expect(initiated.data.amountCents).toBe(40000);

    const confirmed = await confirmSettlement(settlementRepo, ctxA, {
      settlementId: initiated.data.id,
    });
    expect(confirmed.ok).toBe(true);

    // A a reçu 400 € pour une dette de 300 € : le solde s'inverse, A doit 100 € à B.
    const after = await getBalance(expenseRepo, ctxB, {
      householdId: HOUSEHOLD,
      settlements: confirmedSettlements(store, HOUSEHOLD),
    });
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.data).toMatchObject({ from: "A", to: "B", amountCents: 10000 });
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
      balanceAmountCents: balance.data.amountCents,
    });
    expect(initiated.ok).toBe(false);
    if (initiated.ok) return;
    expect(initiated.error.code).toBe("BALANCE_ALREADY_ZERO");
  });
});
