import { describe, it, expect, beforeEach } from "vitest";
import { initiateSettlement } from "./initiate-settlement";
import type { NewSettlement, SettlementRepository } from "./repository";
import type { Settlement, SettlementContext } from "./types";

class FakeSettlementRepository implements SettlementRepository {
  private pendingByHousehold = new Map<string, { id: string }>();
  private seq = 0;

  createCount = 0;
  lastCreate: NewSettlement | null = null;

  seedPending(householdId: string, id = "settlement-existing"): void {
    this.pendingByHousehold.set(householdId, { id });
  }

  async getPendingSettlement(householdId: string): Promise<{ id: string } | null> {
    return this.pendingByHousehold.get(householdId) ?? null;
  }

  async createSettlementAndFreezeExpenses(newSettlement: NewSettlement): Promise<Settlement> {
    this.createCount += 1;
    this.lastCreate = newSettlement;
    this.seq += 1;
    const id = `settlement-${this.seq}`;
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
    this.pendingByHousehold.set(newSettlement.householdId, { id });
    return settlement;
  }
}

const HOUSEHOLD = "H";
const ctxDebtor: SettlementContext = { memberId: "B", householdId: HOUSEHOLD };

let repo: FakeSettlementRepository;
beforeEach(() => {
  repo = new FakeSettlementRepository();
});

describe("initiateSettlement — déclenchement (ch.5.3, D16 v0.3)", () => {
  it("B doit 300 € à A, B déclenche → settlement pending (from B, to A, 30000 c)", async () => {
    const res = await initiateSettlement(repo, ctxDebtor, {
      householdId: HOUSEHOLD,
      fromMemberId: "B",
      toMemberId: "A",
      amountCents: 30000,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.status).toBe("pending");
    expect(res.data.fromMemberId).toBe("B");
    expect(res.data.toMemberId).toBe("A");
    expect(res.data.amountCents).toBe(30000);
    expect(res.data.initiatedBy).toBe("B");
    expect(repo.createCount).toBe(1);
  });

  it("solde nul → BALANCE_ALREADY_ZERO, pas de création", async () => {
    const res = await initiateSettlement(repo, ctxDebtor, {
      householdId: HOUSEHOLD,
      fromMemberId: "B",
      toMemberId: "A",
      amountCents: 0,
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("BALANCE_ALREADY_ZERO");
    expect(repo.createCount).toBe(0);
  });

  it("appelant ≠ débiteur → FORBIDDEN, pas de création", async () => {
    const ctxCreditor: SettlementContext = { memberId: "A", householdId: HOUSEHOLD };
    const res = await initiateSettlement(repo, ctxCreditor, {
      householdId: HOUSEHOLD,
      fromMemberId: "B",
      toMemberId: "A",
      amountCents: 30000,
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("FORBIDDEN");
    expect(repo.createCount).toBe(0);
  });

  it("une régularisation pending déjà en cours → SETTLEMENT_PENDING_EXISTS, pas de création", async () => {
    repo.seedPending(HOUSEHOLD);
    const res = await initiateSettlement(repo, ctxDebtor, {
      householdId: HOUSEHOLD,
      fromMemberId: "B",
      toMemberId: "A",
      amountCents: 30000,
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("SETTLEMENT_PENDING_EXISTS");
    expect(repo.createCount).toBe(0);
  });

  it("foyer hors scope du seam → FORBIDDEN", async () => {
    const res = await initiateSettlement(repo, ctxDebtor, {
      householdId: "AUTRE_FOYER",
      fromMemberId: "B",
      toMemberId: "A",
      amountCents: 30000,
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("FORBIDDEN");
    expect(repo.createCount).toBe(0);
  });
});
