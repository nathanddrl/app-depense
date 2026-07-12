import { describe, it, expect, beforeEach } from "vitest";
import { confirmSettlement } from "./confirm-settlement";
import { cancelSettlement } from "./cancel-settlement";
import type { NewSettlement, SettlementRepository } from "./repository";
import type { Settlement, SettlementContext, SettlementStatus } from "./types";

// ── FakeSettlementRepository : ne porte que ce dont confirm/cancel ont besoin
// (DA11, tests légers). getPendingSettlement/createSettlement/
// listConfirmedSettlements sont hors périmètre ici (T-C6.2). Modèle ledger
// (D7 révisé) : plus de dépenses à gérer, confirm/cancel ne touchent que le
// statut du settlement. ──────────────────────────────────────────
class FakeSettlementRepository implements SettlementRepository {
  private settlements = new Map<string, Settlement>();

  confirmCount = 0;
  cancelCount = 0;

  seed(settlement: Settlement): void {
    this.settlements.set(settlement.id, settlement);
  }

  async getSettlementById(settlementId: string): Promise<Settlement | null> {
    return this.settlements.get(settlementId) ?? null;
  }

  async confirmSettlement(settlementId: string, confirmedBy: string): Promise<Settlement> {
    this.confirmCount += 1;
    const existing = this.settlements.get(settlementId);
    if (!existing) throw new Error("Settlement introuvable.");
    const updated: Settlement = {
      ...existing,
      status: "confirmed",
      confirmedBy,
      confirmedAt: new Date().toISOString(),
    };
    this.settlements.set(settlementId, updated);
    return updated;
  }

  async cancelSettlement(settlementId: string): Promise<Settlement> {
    this.cancelCount += 1;
    const existing = this.settlements.get(settlementId);
    if (!existing) throw new Error("Settlement introuvable.");
    const updated: Settlement = {
      ...existing,
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    };
    this.settlements.set(settlementId, updated);
    return updated;
  }

  async getPendingSettlement(_householdId: string): Promise<{ id: string } | null> {
    throw new Error("non utilisé par ces tests");
  }
  async createSettlement(_newSettlement: NewSettlement): Promise<Settlement> {
    throw new Error("non utilisé par ces tests");
  }
  async listConfirmedSettlements(_householdId: string): Promise<Settlement[]> {
    throw new Error("non utilisé par ces tests");
  }
}

const HOUSEHOLD = "H";
const SETTLEMENT_ID = "settlement-1";

function baseSettlement(status: SettlementStatus = "pending"): Settlement {
  return {
    id: SETTLEMENT_ID,
    householdId: HOUSEHOLD,
    status,
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

const ctxCreditor: SettlementContext = { memberId: "A", householdId: HOUSEHOLD };
const ctxInitiator: SettlementContext = { memberId: "B", householdId: HOUSEHOLD };

let repo: FakeSettlementRepository;
beforeEach(() => {
  repo = new FakeSettlementRepository();
});

describe("confirmSettlement — confirmation par le créancier (ch.5.3, D16 v0.3)", () => {
  it("pending, A (créancier) confirme → confirmed", async () => {
    repo.seed(baseSettlement());

    const res = await confirmSettlement(repo, ctxCreditor, { settlementId: SETTLEMENT_ID });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.status).toBe("confirmed");
    expect(res.data.confirmedBy).toBe("A");
    expect(res.data.confirmedAt).not.toBeNull();
    expect(repo.confirmCount).toBe(1);
  });

  it("B (initiateur/débiteur) tente de s'auto-confirmer → FORBIDDEN", async () => {
    repo.seed(baseSettlement());

    const res = await confirmSettlement(repo, ctxInitiator, { settlementId: SETTLEMENT_ID });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("FORBIDDEN");
    expect(repo.confirmCount).toBe(0);
  });

  it("settlement déjà confirmed → transition illégale (CONFLICT), pas une nouvelle logique", async () => {
    repo.seed(baseSettlement("confirmed"));

    const res = await confirmSettlement(repo, ctxCreditor, { settlementId: SETTLEMENT_ID });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("CONFLICT");
    expect(repo.confirmCount).toBe(0);
  });

  it("settlement introuvable → NOT_FOUND", async () => {
    const res = await confirmSettlement(repo, ctxCreditor, { settlementId: "inconnu" });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("NOT_FOUND");
  });
});

describe("cancelSettlement — annulation/refus (ch.5.3, D7 révisé, D16 v0.3)", () => {
  it("pending, A (créancier) refuse → cancelled, solde inchangé (aucune dépense touchée)", async () => {
    repo.seed(baseSettlement());

    const res = await cancelSettlement(repo, ctxCreditor, { settlementId: SETTLEMENT_ID });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.status).toBe("cancelled");
    expect(res.data.cancelledAt).not.toBeNull();
    expect(repo.cancelCount).toBe(1);
  });

  it("B (initiateur) annule aussi → cancelled", async () => {
    repo.seed(baseSettlement());

    const res = await cancelSettlement(repo, ctxInitiator, { settlementId: SETTLEMENT_ID });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.status).toBe("cancelled");
    expect(repo.cancelCount).toBe(1);
  });

  it("membre tiers (ni initiateur ni créancier) → FORBIDDEN", async () => {
    repo.seed(baseSettlement());
    const ctxTiers: SettlementContext = { memberId: "C", householdId: HOUSEHOLD };

    const res = await cancelSettlement(repo, ctxTiers, { settlementId: SETTLEMENT_ID });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("FORBIDDEN");
    expect(repo.cancelCount).toBe(0);
  });

  it("settlement déjà cancelled → transition illégale (CONFLICT)", async () => {
    repo.seed(baseSettlement("cancelled"));

    const res = await cancelSettlement(repo, ctxCreditor, { settlementId: SETTLEMENT_ID });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("CONFLICT");
    expect(repo.cancelCount).toBe(0);
  });

  it("settlement introuvable → NOT_FOUND", async () => {
    const res = await cancelSettlement(repo, ctxCreditor, { settlementId: "inconnu" });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("NOT_FOUND");
  });
});
