import { describe, it, expect, beforeEach } from "vitest";
import { addAid, removeAid } from "./index";
import type { AidRepository, ExpenseForAid, NewAid } from "./repository";
import type { AidContext, AidDTO, Expense, ExpenseShareDTO } from "./types";

// ── FakeAidRepository : implémentation en mémoire du port (DA11, tests légers,
// zéro Docker). Prouve le CÂBLAGE (le domaine persiste les parts renvoyées par
// calc-engine, valide avant de toucher la persistance) ; la justesse arithmétique
// est déjà couverte exhaustivement en C1/C5. ────────────────────────────────────
class FakeAidRepository implements AidRepository {
  private expenses = new Map<string, ExpenseForAid>();
  private aidToExpense = new Map<string, string>();
  private seq = 0;

  addCount = 0;
  removeCount = 0;
  lastAdd: { newAid: NewAid; shares: ExpenseShareDTO[] } | null = null;
  lastRemove: { aidId: string; shares: ExpenseShareDTO[] } | null = null;

  constructor(private readonly membersByHousehold: Record<string, string[]>) {}

  /** Injecte une dépense arbitraire (ex. verrouillée, avec aides existantes). */
  seed(expense: ExpenseForAid): void {
    this.expenses.set(expense.id, expense);
    for (const a of expense.aids) this.aidToExpense.set(a.id, expense.id);
  }

  async getHouseholdMemberIds(householdId: string): Promise<string[]> {
    return this.membersByHousehold[householdId] ?? [];
  }

  async getExpenseForAid(expenseId: string): Promise<ExpenseForAid | null> {
    return this.expenses.get(expenseId) ?? null;
  }

  async getAidById(aidId: string): Promise<{ id: string; expenseId: string } | null> {
    const expenseId = this.aidToExpense.get(aidId);
    if (!expenseId) return null;
    return { id: aidId, expenseId };
  }

  async addAid(newAid: NewAid, shares: ExpenseShareDTO[]): Promise<Expense> {
    this.addCount += 1;
    this.lastAdd = { newAid, shares };
    const current = this.expenses.get(newAid.expenseId);
    if (!current) throw new Error("test: addAid sur dépense inconnue");
    const aid: AidDTO = {
      id: `aid-${this.seq++}`,
      beneficiaryId: newAid.beneficiaryId,
      label: newAid.label,
      amountCents: newAid.amountCents,
    };
    const updated: ExpenseForAid = { ...current, aids: [...current.aids, aid] };
    this.expenses.set(newAid.expenseId, updated);
    this.aidToExpense.set(aid.id, newAid.expenseId);
    return this.toExpense(updated, shares);
  }

  async removeAid(aidId: string, shares: ExpenseShareDTO[]): Promise<Expense> {
    this.removeCount += 1;
    this.lastRemove = { aidId, shares };
    const expenseId = this.aidToExpense.get(aidId);
    if (!expenseId) throw new Error("test: removeAid sur aide inconnue");
    const current = this.expenses.get(expenseId);
    if (!current) throw new Error("test: removeAid sur dépense inconnue");
    const updated: ExpenseForAid = {
      ...current,
      aids: current.aids.filter((a) => a.id !== aidId),
    };
    this.expenses.set(expenseId, updated);
    this.aidToExpense.delete(aidId);
    return this.toExpense(updated, shares);
  }

  private toExpense(e: ExpenseForAid, shares: ExpenseShareDTO[]): Expense {
    return {
      id: e.id,
      householdId: e.householdId,
      grossCents: e.grossCents,
      payerId: e.payerId,
      settlementId: e.settlementId,
      shares,
      aids: e.aids,
    };
  }
}

const HOUSEHOLD = "H";
const ctx: AidContext = { memberId: "A", householdId: HOUSEHOLD };
const ratio5050 = [
  { memberId: "A", pct: 50 },
  { memberId: "B", pct: 50 },
];

function baseExpense(overrides: Partial<ExpenseForAid> = {}): ExpenseForAid {
  return {
    id: "exp-1",
    householdId: HOUSEHOLD,
    grossCents: 80000,
    payerId: "A",
    settlementId: null,
    ratio: ratio5050,
    aids: [],
    ...overrides,
  };
}

let repo: FakeAidRepository;
beforeEach(() => {
  repo = new FakeAidRepository({ [HOUSEHOLD]: ["A", "B"] });
});

describe("addAid — recompute des parts (spec 4.1/4.3, D9/D10)", () => {
  it("loyer 800€ + APL 200€ sur A → net 600€, parts 300€/300€", async () => {
    repo.seed(baseExpense());
    const res = await addAid(repo, ctx, {
      expenseId: "exp-1",
      label: "APL",
      beneficiaryId: "A",
      amountCents: 20000,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const byMember = Object.fromEntries(res.data.shares.map((s) => [s.memberId, s.cents]));
    expect(byMember.A).toBe(30000);
    expect(byMember.B).toBe(30000);
    expect(res.data.aids).toHaveLength(1);
    expect(res.data.aids[0].label).toBe("APL");
    expect(repo.addCount).toBe(1);
  });

  it("plusieurs aides déjà présentes → nouvelle aide s'ajoute, tout est recomputé", async () => {
    repo.seed(
      baseExpense({
        aids: [{ id: "aid-existing", beneficiaryId: "A", label: "APL", amountCents: 10000 }],
      }),
    );
    const res = await addAid(repo, ctx, {
      expenseId: "exp-1",
      label: "Prime",
      beneficiaryId: "B",
      amountCents: 10000,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // brut 800€ − (100€ + 100€) = 600€, réparti 50/50 → 300€/300€
    const byMember = Object.fromEntries(res.data.shares.map((s) => [s.memberId, s.cents]));
    expect(byMember.A).toBe(30000);
    expect(byMember.B).toBe(30000);
  });

  it("bénéficiaire hors foyer → VALIDATION_ERROR (beneficiaryId), aucun ajout", async () => {
    repo.seed(baseExpense());
    const res = await addAid(repo, ctx, {
      expenseId: "exp-1",
      label: "APL",
      beneficiaryId: "Z",
      amountCents: 20000,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("VALIDATION_ERROR");
    expect(res.error.field).toBe("beneficiaryId");
    expect(repo.addCount).toBe(0);
  });

  it("montant 0 → refus, aucun ajout", async () => {
    repo.seed(baseExpense());
    const res = await addAid(repo, ctx, {
      expenseId: "exp-1",
      label: "APL",
      beneficiaryId: "A",
      amountCents: 0,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("VALIDATION_ERROR");
    expect(repo.addCount).toBe(0);
  });

  it("montant négatif → refus, aucun ajout", async () => {
    repo.seed(baseExpense());
    const res = await addAid(repo, ctx, {
      expenseId: "exp-1",
      label: "APL",
      beneficiaryId: "A",
      amountCents: -100,
    });
    expect(res.ok).toBe(false);
    expect(repo.addCount).toBe(0);
  });

  it("dépense verrouillée (settlement) → EXPENSE_LOCKED, aucun ajout", async () => {
    repo.seed(baseExpense({ settlementId: "settle-1" }));
    const res = await addAid(repo, ctx, {
      expenseId: "exp-1",
      label: "APL",
      beneficiaryId: "A",
      amountCents: 20000,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("EXPENSE_LOCKED");
    expect(repo.addCount).toBe(0);
  });

  it("dépense introuvable → NOT_FOUND", async () => {
    const res = await addAid(repo, ctx, {
      expenseId: "nope",
      label: "APL",
      beneficiaryId: "A",
      amountCents: 20000,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("NOT_FOUND");
  });

  it("foyer non autorisé (mismatch seam) → FORBIDDEN, aucun ajout", async () => {
    repo.seed(baseExpense({ householdId: "AUTRE" }));
    const res = await addAid(repo, ctx, {
      expenseId: "exp-1",
      label: "APL",
      beneficiaryId: "A",
      amountCents: 20000,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("FORBIDDEN");
    expect(repo.addCount).toBe(0);
  });

  it("aide > charge → warning AID_EXCEEDS_CHARGE, parts à 0", async () => {
    repo.seed(baseExpense());
    const res = await addAid(repo, ctx, {
      expenseId: "exp-1",
      label: "APL",
      beneficiaryId: "A",
      amountCents: 90000,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.shares.every((s) => s.cents === 0)).toBe(true);
    expect(res.warnings?.[0]?.code).toBe("AID_EXCEEDS_CHARGE");
  });
});

describe("removeAid — recompute des parts après retrait", () => {
  it("retire l'unique aide → retour à la charge brute répartie", async () => {
    repo.seed(
      baseExpense({
        aids: [{ id: "aid-1", beneficiaryId: "A", label: "APL", amountCents: 20000 }],
      }),
    );
    const res = await removeAid(repo, ctx, { aidId: "aid-1" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const byMember = Object.fromEntries(res.data.shares.map((s) => [s.memberId, s.cents]));
    expect(byMember.A).toBe(40000);
    expect(byMember.B).toBe(40000);
    expect(res.data.aids).toHaveLength(0);
    expect(repo.removeCount).toBe(1);
  });

  it("retire une aide parmi plusieurs → seules les restantes comptent", async () => {
    repo.seed(
      baseExpense({
        aids: [
          { id: "aid-1", beneficiaryId: "A", label: "APL", amountCents: 10000 },
          { id: "aid-2", beneficiaryId: "B", label: "Prime", amountCents: 10000 },
        ],
      }),
    );
    const res = await removeAid(repo, ctx, { aidId: "aid-1" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // brut 800€ − 100€ restante = 700€, réparti 50/50 → 350€/350€
    const byMember = Object.fromEntries(res.data.shares.map((s) => [s.memberId, s.cents]));
    expect(byMember.A).toBe(35000);
    expect(byMember.B).toBe(35000);
    expect(res.data.aids.map((a) => a.id)).toEqual(["aid-2"]);
  });

  it("aide introuvable → NOT_FOUND", async () => {
    repo.seed(baseExpense());
    const res = await removeAid(repo, ctx, { aidId: "nope" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("NOT_FOUND");
  });

  it("dépense verrouillée (settlement) → EXPENSE_LOCKED, aucun retrait", async () => {
    repo.seed(
      baseExpense({
        settlementId: "settle-1",
        aids: [{ id: "aid-1", beneficiaryId: "A", label: "APL", amountCents: 20000 }],
      }),
    );
    const res = await removeAid(repo, ctx, { aidId: "aid-1" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("EXPENSE_LOCKED");
    expect(repo.removeCount).toBe(0);
  });

  it("foyer non autorisé (mismatch seam) → FORBIDDEN, aucun retrait", async () => {
    repo.seed(
      baseExpense({
        householdId: "AUTRE",
        aids: [{ id: "aid-1", beneficiaryId: "A", label: "APL", amountCents: 20000 }],
      }),
    );
    const res = await removeAid(repo, ctx, { aidId: "aid-1" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("FORBIDDEN");
    expect(repo.removeCount).toBe(0);
  });
});
