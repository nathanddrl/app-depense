import { describe, it, expect } from "vitest";
import { computeExpense, CalcPreconditionError } from "./index";
import type { ComputedExpense, Share, EffectiveAid } from "./index";

const sumShares = (c: ComputedExpense) => c.shares.reduce((s, x) => s + x.cents, 0);
const sumAids = (c: ComputedExpense) => c.effectiveAids.reduce((s, x) => s + x.effectiveCents, 0);
const share = (c: ComputedExpense, id: string) => c.shares.find((s) => s.memberId === id) as Share;
const aid = (c: ComputedExpense, id: string) =>
  c.effectiveAids.find((a) => a.beneficiaryId === id) as EffectiveAid | undefined;

const ratio5050 = [
  { memberId: "A", pct: 50 },
  { memberId: "B", pct: 50 },
];

describe("computeExpense — pipeline canonique (4.1) + plafond aide (4.4)", () => {
  it("sans aide → net = brut, se comporte comme computeShares", () => {
    const c = computeExpense({ grossCents: 80000, payerId: "A", ratio: ratio5050 });
    expect(c.netCents).toBe(80000);
    expect(share(c, "A").cents).toBe(40000);
    expect(share(c, "B").cents).toBe(40000);
    expect(c.effectiveAids).toEqual([]);
    expect(c.warnings).toEqual([]);
  });

  it("loyer 800€ + APL 200€ (bénéf. A) → net 60000, parts 30000/30000, aide eff A=20000", () => {
    const c = computeExpense({
      grossCents: 80000,
      payerId: "A",
      ratio: ratio5050,
      aids: [{ beneficiaryId: "A", amountCents: 20000 }],
    });
    expect(c.netCents).toBe(60000);
    expect(share(c, "A").cents).toBe(30000);
    expect(share(c, "B").cents).toBe(30000);
    expect(aid(c, "A")?.effectiveCents).toBe(20000);
    expect(c.warnings).toEqual([]);
  });

  it("net = brut − Σ aides sur plusieurs aides", () => {
    const c = computeExpense({
      grossCents: 80000,
      payerId: "A",
      ratio: ratio5050,
      aids: [
        { beneficiaryId: "A", amountCents: 10000 },
        { beneficiaryId: "B", amountCents: 5000 },
      ],
    });
    expect(c.netCents).toBe(65000);
    expect(sumShares(c)).toBe(65000);
    expect(aid(c, "A")?.effectiveCents).toBe(10000);
    expect(aid(c, "B")?.effectiveCents).toBe(5000);
  });

  it("plusieurs aides même bénéficiaire → agrégées par bénéficiaire", () => {
    const c = computeExpense({
      grossCents: 80000,
      payerId: "A",
      ratio: ratio5050,
      aids: [
        { beneficiaryId: "A", amountCents: 12000 },
        { beneficiaryId: "A", amountCents: 8000 },
      ],
    });
    expect(c.netCents).toBe(60000);
    expect(c.effectiveAids).toHaveLength(1);
    expect(aid(c, "A")?.effectiveCents).toBe(20000);
  });

  describe("aide > charge (4.4 / D11)", () => {
    it("aide 900€ sur charge 800€ → net 0, parts 0, warning, Σ aides eff = brut", () => {
      const c = computeExpense({
        grossCents: 80000,
        payerId: "A",
        ratio: ratio5050,
        aids: [{ beneficiaryId: "A", amountCents: 90000 }],
      });
      expect(c.netCents).toBe(0);
      expect(c.shares.every((s) => s.cents === 0)).toBe(true);
      expect(c.warnings).toEqual(["AID_EXCEEDS_CHARGE"]);
      // plafond : Σ aide effective = brut (le surplus est ignoré, non reporté)
      expect(sumAids(c)).toBe(80000);
      expect(aid(c, "A")?.effectiveCents).toBe(80000);
    });

    it("plafond réparti par bénéficiaire au prorata, reliquat au payeur", () => {
      // 2 bénéficiaires, Σ aides = 1000, brut = 999 (< Σ). Prorata de 999 :
      // A: floor(999*600/1000)=599 ; B: floor(999*400/1000)=399 ; Σ=998 ; reliquat 1 → payeur A
      const c = computeExpense({
        grossCents: 999,
        payerId: "A",
        ratio: ratio5050,
        aids: [
          { beneficiaryId: "A", amountCents: 600 },
          { beneficiaryId: "B", amountCents: 400 },
        ],
      });
      expect(c.netCents).toBe(0);
      expect(c.warnings).toEqual(["AID_EXCEEDS_CHARGE"]);
      expect(aid(c, "A")?.effectiveCents).toBe(600); // 599 + reliquat 1
      expect(aid(c, "B")?.effectiveCents).toBe(399);
      expect(sumAids(c)).toBe(999);
    });

    it("payeur non-bénéficiaire → reçoit une ligne aide eff = reliquat (§337)", () => {
      // B seul bénéficiaire, payeur = A. Plafond brut=999 réparti : B floor(999*1000/1000)=999,
      // reliquat 0 → A n'a pas de reliquat ici. On force un reliquat avec 2 bénéf non-payeur.
      const c = computeExpense({
        grossCents: 100,
        payerId: "A", // A ne perçoit AUCUNE aide
        ratio: [
          { memberId: "A", pct: 50 },
          { memberId: "B", pct: 30 },
          { memberId: "C", pct: 20 },
        ],
        aids: [
          { beneficiaryId: "B", amountCents: 200 },
          { beneficiaryId: "C", amountCents: 100 },
        ],
      });
      // Σ aides = 300 > 100. Prorata de 100 : B floor(100*200/300)=66 ; C floor(100*100/300)=33
      // Σ=99, reliquat 1 → payeur A (créé). Σ aides eff = 100.
      expect(c.netCents).toBe(0);
      expect(aid(c, "B")?.effectiveCents).toBe(66);
      expect(aid(c, "C")?.effectiveCents).toBe(33);
      expect(aid(c, "A")?.effectiveCents).toBe(1); // ligne créée pour le payeur = reliquat
      expect(sumAids(c)).toBe(100);
    });

    it("Σ aides == brut exactement → net 0 SANS warning, aide eff = aide brute", () => {
      const c = computeExpense({
        grossCents: 80000,
        payerId: "A",
        ratio: ratio5050,
        aids: [{ beneficiaryId: "A", amountCents: 80000 }],
      });
      expect(c.netCents).toBe(0);
      expect(c.warnings).toEqual([]); // pas un dépassement
      expect(aid(c, "A")?.effectiveCents).toBe(80000);
      expect(c.shares.every((s) => s.cents === 0)).toBe(true);
    });
  });

  describe("préconditions → CalcPreconditionError", () => {
    it("grossCents ≤ 0", () => {
      expect(() => computeExpense({ grossCents: 0, payerId: "A", ratio: ratio5050 })).toThrow(
        CalcPreconditionError,
      );
      expect(() => computeExpense({ grossCents: -100, payerId: "A", ratio: ratio5050 })).toThrow(
        CalcPreconditionError,
      );
    });

    it("grossCents non entier", () => {
      expect(() => computeExpense({ grossCents: 100.5, payerId: "A", ratio: ratio5050 })).toThrow(
        CalcPreconditionError,
      );
    });

    it("Σ pct ≠ 100", () => {
      expect(() =>
        computeExpense({
          grossCents: 1000,
          payerId: "A",
          ratio: [
            { memberId: "A", pct: 60 },
            { memberId: "B", pct: 30 },
          ],
        }),
      ).toThrow(CalcPreconditionError);
    });

    it("montant d'aide ≤ 0", () => {
      expect(() =>
        computeExpense({
          grossCents: 1000,
          payerId: "A",
          ratio: ratio5050,
          aids: [{ beneficiaryId: "A", amountCents: 0 }],
        }),
      ).toThrow(CalcPreconditionError);
    });
  });
});
