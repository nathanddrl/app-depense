import { describe, it, expect } from "vitest";
import { getCurrentSettlement } from "./get-current-settlement";
import type { NewSettlement, SettlementRepository } from "./repository";
import type { Settlement, SettlementContext } from "./types";

// ── FakeSettlementRepository : ne porte que ce dont getCurrentSettlement a
// besoin (DA11, tests légers). ────────────────────────────────────────────
class FakeSettlementRepository implements SettlementRepository {
  constructor(private readonly settlements: Map<string, Settlement>) {}

  async getPendingSettlement(householdId: string): Promise<{ id: string } | null> {
    for (const s of this.settlements.values()) {
      if (s.householdId === householdId && s.status === "pending") return { id: s.id };
    }
    return null;
  }

  async getSettlementById(settlementId: string): Promise<Settlement | null> {
    return this.settlements.get(settlementId) ?? null;
  }

  async createSettlementAndFreezeExpenses(_newSettlement: NewSettlement): Promise<Settlement> {
    throw new Error("non utilisé par ces tests");
  }
  async confirmSettlement(_settlementId: string, _confirmedBy: string): Promise<Settlement> {
    throw new Error("non utilisé par ces tests");
  }
  async cancelSettlement(_settlementId: string): Promise<Settlement> {
    throw new Error("non utilisé par ces tests");
  }
}

const HOUSEHOLD = "H";
const ctx: SettlementContext = { memberId: "A", householdId: HOUSEHOLD };

function pendingSettlement(): Settlement {
  return {
    id: "settlement-1",
    householdId: HOUSEHOLD,
    status: "pending",
    amountCents: 30000,
    fromMemberId: "B",
    toMemberId: "A",
    initiatedBy: "B",
    initiatedAt: new Date().toISOString(),
    confirmedBy: null,
    confirmedAt: null,
    cancelledAt: null,
  };
}

describe("getCurrentSettlement — lecture pour l'UI (ch.5.3, T-C6.6)", () => {
  it("une régularisation pending existe → la renvoie", async () => {
    const repo = new FakeSettlementRepository(new Map([["settlement-1", pendingSettlement()]]));

    const res = await getCurrentSettlement(repo, ctx, { householdId: HOUSEHOLD });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data?.id).toBe("settlement-1");
    expect(res.data?.status).toBe("pending");
  });

  it("aucune régularisation pending → null", async () => {
    const repo = new FakeSettlementRepository(new Map());

    const res = await getCurrentSettlement(repo, ctx, { householdId: HOUSEHOLD });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toBeNull();
  });

  it("foyer hors scope du seam → FORBIDDEN", async () => {
    const repo = new FakeSettlementRepository(new Map());

    const res = await getCurrentSettlement(repo, ctx, { householdId: "AUTRE_FOYER" });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("FORBIDDEN");
  });
});
