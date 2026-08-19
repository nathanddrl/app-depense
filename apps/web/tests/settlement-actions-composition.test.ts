// Suite d'intégration — composition getBalance ↔ initiateSettlement au niveau
// des Server Actions (T-SOLDE3). Complète `settlement-lifecycle.test.ts`, qui
// prouve que les packages `domain-*` PURS tiennent ensemble bout en bout via
// une composition CORRECTE (settlements confirmés explicitement transmis à
// `getBalance`, exactement comme `actions.ts` doit le faire) — mais qui
// n'exerce jamais `apps/web/app/actions.ts` lui-même. Cette suite-ci exerce le
// point de composition réel : `initiateSettlementAction`/`getBalanceAction`,
// avec `@app/db` et `../lib/auth/context` mockés (fakes en mémoire, même
// pattern d'état partagé que `settlement-lifecycle.test.ts`).
//
// Bug reproduit : `initiateSettlementAction` appelait
// `getBalance(expenseRepo, domainCtx, { householdId })` SANS charger les
// règlements confirmés (`settlements`), contrairement à `getBalanceAction` qui
// les charge via `listConfirmedSettlements` et les transmet. Le solde interne
// utilisé pour la vérification « seul le débiteur peut déclencher »
// (domain-settlement, D16) restait donc basé sur les seules dépenses,
// ignorant tout règlement déjà confirmé — y compris un règlement qui a inversé
// le sens de la dette (D15 v0.5). Un nouveau débiteur légitime (après
// inversion) se voyait alors refuser son propre déclenchement.
//
// Scénario minimal qui fait diverger les deux chemins : A paie 800 € de loyer
// (split 50/50) → B doit 400 € à A. B règle 500 € (montant > solde, D15 v0.5)
// → A confirme → le solde s'inverse, A doit désormais 100 € à B. A (nouveau
// débiteur) déclenche à son tour : avant le fix, `initiateSettlementAction`
// rejette avec FORBIDDEN car son calcul interne (sans règlements) pense
// encore que B est le débiteur ; après le fix, il doit réussir.

import { describe, it, expect, beforeEach, vi } from "vitest";

// `vi.hoisted` : l'état partagé et le membre courant doivent exister avant que
// les factories `vi.mock` (hoistées par Vitest) ne les capturent — `HOUSEHOLD`
// est donc défini ici aussi (pas de référence à une const externe, non encore
// initialisée à ce point de l'exécution hoistée).
const { HOUSEHOLD, store, session, resetStore } = vi.hoisted(() => {
  const HOUSEHOLD = "H";
  type StoredExpense = {
    id: string;
    householdId: string;
    label: string;
    category: string;
    grossCents: number;
    payerId: string;
    incurredOn: string;
    source: "manual" | "recurring";
    shares: { memberId: string; cents: number; pctSnapshot: number }[];
    aids: unknown[];
    deletedAt: string | null;
  };
  type StoredSettlement = {
    id: string;
    householdId: string;
    status: "pending" | "confirmed" | "cancelled";
    amountCents: number;
    fromMemberId: string;
    toMemberId: string;
    initiatedBy: string;
    initiatedAt: string;
    confirmedBy: string | null;
    confirmedAt: string | null;
    cancelledAt: string | null;
  };
  const store = {
    memberIds: { [HOUSEHOLD]: ["A", "B"] } as Record<string, string[]>,
    expenses: new Map<string, StoredExpense>(),
    settlements: new Map<string, StoredSettlement>(),
  };
  const session = { memberId: "A" };
  function resetStore() {
    store.memberIds = { [HOUSEHOLD]: ["A", "B"] };
    store.expenses.clear();
    store.settlements.clear();
    session.memberId = "A";
  }
  return { HOUSEHOLD, store, session, resetStore };
});

// Contexte authentifié : `getCurrentContext` bascule sur `session.memberId`,
// pour rejouer une action « en tant que A » ou « en tant que B » sans
// re-mocker à chaque test (même rôle que resolveContext, sans Next/Supabase).
vi.mock("../lib/auth/context", () => ({
  getCurrentContext: async () => ({
    supabase: {},
    member: { id: session.memberId, displayName: session.memberId, email: "" },
    householdId: HOUSEHOLD,
    role: "member",
  }),
  requireAdmin: () => null,
}));

// Fakes en mémoire pour les 4 repos construits par `actions.ts` — seuls
// `SupabaseExpenseRepository`/`SupabaseSettlementRepository` sont réellement
// exercés par les actions testées ici.
vi.mock("@app/db", () => {
  class FakeExpenseRepository {
    async getHouseholdMemberIds(householdId: string) {
      return store.memberIds[householdId] ?? [];
    }
    async listExpensesForBalance(householdId: string) {
      return [...store.expenses.values()]
        .filter((e) => e.householdId === householdId && e.deletedAt === null)
        .map((e) => ({
          label: e.label,
          grossCents: e.grossCents,
          payerId: e.payerId,
          incurredOn: e.incurredOn,
          shares: e.shares,
          aids: e.aids,
          source: e.source,
        }));
    }
    async getExpenseById() {
      throw new Error("non utilisé par cette suite");
    }
    async updateExpenseWithShares() {
      throw new Error("non utilisé par cette suite");
    }
    async softDeleteExpense() {
      throw new Error("non utilisé par cette suite");
    }
    async insertExpenseWithShares() {
      throw new Error("non utilisé par cette suite");
    }
    async listExpenses() {
      throw new Error("non utilisé par cette suite");
    }
    async listExpenseMonths() {
      throw new Error("non utilisé par cette suite");
    }
    async listAllExpensesForAdmin() {
      throw new Error("non utilisé par cette suite");
    }
  }

  class FakeSettlementRepository {
    async getPendingSettlement(householdId: string) {
      for (const s of store.settlements.values()) {
        if (s.householdId === householdId && s.status === "pending") return { id: s.id };
      }
      return null;
    }
    async createSettlement(newSettlement: {
      householdId: string;
      amountCents: number;
      fromMemberId: string;
      toMemberId: string;
      initiatedBy: string;
    }) {
      const id = `settlement-${store.settlements.size + 1}`;
      const settlement = {
        id,
        householdId: newSettlement.householdId,
        status: "pending" as const,
        amountCents: newSettlement.amountCents,
        fromMemberId: newSettlement.fromMemberId,
        toMemberId: newSettlement.toMemberId,
        initiatedBy: newSettlement.initiatedBy,
        initiatedAt: new Date().toISOString(),
        confirmedBy: null,
        confirmedAt: null,
        cancelledAt: null,
      };
      store.settlements.set(id, settlement);
      return settlement;
    }
    async getSettlementById(settlementId: string) {
      return store.settlements.get(settlementId) ?? null;
    }
    async confirmSettlement(settlementId: string, confirmedBy: string) {
      const existing = store.settlements.get(settlementId);
      if (!existing) throw new Error("test: settlement inconnu");
      const updated = {
        ...existing,
        status: "confirmed" as const,
        confirmedBy,
        confirmedAt: new Date().toISOString(),
      };
      store.settlements.set(settlementId, updated);
      return updated;
    }
    async cancelSettlement(settlementId: string) {
      const existing = store.settlements.get(settlementId);
      if (!existing) throw new Error("test: settlement inconnu");
      const updated = {
        ...existing,
        status: "cancelled" as const,
        cancelledAt: new Date().toISOString(),
      };
      store.settlements.set(settlementId, updated);
      return updated;
    }
    async listConfirmedSettlements(householdId: string) {
      return [...store.settlements.values()].filter(
        (s) => s.householdId === householdId && s.status === "confirmed",
      );
    }
  }

  class Unused {}

  return {
    SupabaseExpenseRepository: FakeExpenseRepository,
    SupabaseSettlementRepository: FakeSettlementRepository,
    SupabaseAidRepository: Unused,
    SupabaseRecurringTemplateRepository: Unused,
  };
});

const { getBalanceAction, initiateSettlementAction, confirmSettlementAction } = await import(
  "../app/actions"
);

function seedRentExpense(): void {
  // A paie 800 € de loyer, split 50/50 → B doit 400 € à A.
  store.expenses.set("exp-1", {
    id: "exp-1",
    householdId: HOUSEHOLD,
    label: "Loyer",
    category: "loyer",
    grossCents: 80000,
    payerId: "A",
    incurredOn: "2026-07-01",
    source: "manual",
    shares: [
      { memberId: "A", cents: 40000, pctSnapshot: 50 },
      { memberId: "B", cents: 40000, pctSnapshot: 50 },
    ],
    aids: [],
    deletedAt: null,
  });
}

describe("composition getBalance ↔ initiateSettlement au niveau Server Action (T-SOLDE3)", () => {
  beforeEach(() => {
    resetStore();
  });

  it("après une régularisation confirmée qui inverse le solde, le nouveau débiteur peut déclencher (reflète getBalanceAction)", async () => {
    seedRentExpense();

    // Solde initial, vu par l'écran : B doit 400 € à A.
    session.memberId = "B";
    const initialBalance = await getBalanceAction();
    expect(initialBalance.ok).toBe(true);
    if (!initialBalance.ok) return;
    expect(initialBalance.data).toMatchObject({ from: "B", to: "A", amountCents: 40000 });

    // B règle 500 € (> 400 € dus, D15 v0.5) : pending accepté.
    const initiated = await initiateSettlementAction({ amountCents: 50000 });
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) return;
    expect(initiated.data).toMatchObject({ fromMemberId: "B", toMemberId: "A", status: "pending" });

    // A confirme la réception.
    session.memberId = "A";
    const confirmed = await confirmSettlementAction({ settlementId: initiated.data.id });
    expect(confirmed.ok).toBe(true);

    // Le solde affiché à l'écran (`getBalanceAction`, source de vérité) s'est
    // inversé : A doit désormais 100 € à B.
    const invertedBalance = await getBalanceAction();
    expect(invertedBalance.ok).toBe(true);
    if (!invertedBalance.ok) return;
    expect(invertedBalance.data).toMatchObject({ from: "A", to: "B", amountCents: 10000 });

    // A, le nouveau débiteur légitime, déclenche à son tour. Avant le fix,
    // `initiateSettlementAction` recalculait un solde SANS les règlements
    // confirmés (from=B encore, ignorant l'inversion) et rejetait A avec
    // FORBIDDEN — alors que l'écran (`getBalanceAction`, ci-dessus) montre
    // sans ambiguïté que A est bien le débiteur actuel.
    const secondInitiated = await initiateSettlementAction({ amountCents: 10000 });
    expect(secondInitiated.ok).toBe(true);
    if (!secondInitiated.ok) return;
    expect(secondInitiated.data).toMatchObject({
      fromMemberId: "A",
      toMemberId: "B",
      amountCents: 10000,
      status: "pending",
    });
  });
});
