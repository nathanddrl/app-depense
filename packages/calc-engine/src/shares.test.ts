import { describe, it, expect } from "vitest";
import { computeShares, CalcPreconditionError } from "./index";
import type { Share } from "./index";

const cents = (shares: Share[]) => shares.reduce((s, x) => s + x.cents, 0);
const byId = (shares: Share[], id: string) => shares.find((s) => s.memberId === id) as Share;

describe("computeShares — répartition floor + reliquat au payeur (4.3 / annexe B)", () => {
  it("loyer 800€ payé par A, 50/50 → 5000c / 5000c, Σ exact", () => {
    const shares = computeShares(
      80000,
      [
        { memberId: "A", pct: 50 },
        { memberId: "B", pct: 50 },
      ],
      "A",
    );
    expect(byId(shares, "A").cents).toBe(40000);
    expect(byId(shares, "B").cents).toBe(40000);
    expect(cents(shares)).toBe(80000);
  });

  it("ratio 70/30 sur 100€ → 7000 / 3000, Σ exact", () => {
    const shares = computeShares(
      10000,
      [
        { memberId: "A", pct: 70 },
        { memberId: "B", pct: 30 },
      ],
      "A",
    );
    expect(byId(shares, "A").cents).toBe(7000);
    expect(byId(shares, "B").cents).toBe(3000);
    expect(cents(shares)).toBe(10000);
  });

  it("10,00€ en 3 parts, +1c chez le payeur → 334 / 333 / 333, Σ = 1000", () => {
    const shares = computeShares(
      1000,
      [
        { memberId: "A", pct: 33.34 },
        { memberId: "B", pct: 33.33 },
        { memberId: "C", pct: 33.33 },
      ],
      "A", // le payeur absorbe le reliquat
    );
    expect(byId(shares, "A").cents).toBe(334);
    expect(byId(shares, "B").cents).toBe(333);
    expect(byId(shares, "C").cents).toBe(333);
    expect(cents(shares)).toBe(1000);
  });

  it("le reliquat va au payeur même si le payeur n'a pas le plus gros pct", () => {
    const shares = computeShares(
      1000,
      [
        { memberId: "A", pct: 33.34 },
        { memberId: "B", pct: 33.33 },
        { memberId: "C", pct: 33.33 },
      ],
      "C", // C paie → C absorbe le +1c
    );
    expect(byId(shares, "A").cents).toBe(333);
    expect(byId(shares, "B").cents).toBe(333);
    expect(byId(shares, "C").cents).toBe(334);
    expect(cents(shares)).toBe(1000);
  });

  it("ratio 100/0, payeur = le membre à 0% → sa part vaut le reliquat (ici 0)", () => {
    const shares = computeShares(
      10000,
      [
        { memberId: "A", pct: 100 },
        { memberId: "B", pct: 0 },
      ],
      "B",
    );
    expect(byId(shares, "A").cents).toBe(10000);
    expect(byId(shares, "B").cents).toBe(0);
    expect(cents(shares)).toBe(10000);
  });

  it("snapshot du pct conservé pour transparence", () => {
    const shares = computeShares(
      1000,
      [
        { memberId: "A", pct: 33.34 },
        { memberId: "B", pct: 66.66 },
      ],
      "A",
    );
    expect(byId(shares, "A").pctSnapshot).toBe(33.34);
    expect(byId(shares, "B").pctSnapshot).toBe(66.66);
  });

  it("net = 0 → toutes parts à 0, Σ = 0", () => {
    const shares = computeShares(
      0,
      [
        { memberId: "A", pct: 50 },
        { memberId: "B", pct: 50 },
      ],
      "A",
    );
    expect(cents(shares)).toBe(0);
    expect(shares.every((s) => s.cents === 0)).toBe(true);
  });

  describe("préconditions → CalcPreconditionError (défense en profondeur, ch.7)", () => {
    it("payeur absent du ratio", () => {
      expect(() => computeShares(1000, [{ memberId: "A", pct: 100 }], "Z")).toThrow(
        CalcPreconditionError,
      );
    });

    it("Σ pct ≠ 100", () => {
      expect(() =>
        computeShares(
          1000,
          [
            { memberId: "A", pct: 60 },
            { memberId: "B", pct: 30 },
          ],
          "A",
        ),
      ).toThrow(CalcPreconditionError);
    });

    it("pct négatif", () => {
      expect(() =>
        computeShares(
          1000,
          [
            { memberId: "A", pct: 120 },
            { memberId: "B", pct: -20 },
          ],
          "A",
        ),
      ).toThrow(CalcPreconditionError);
    });

    it("netCents non entier", () => {
      expect(() => computeShares(100.5, [{ memberId: "A", pct: 100 }], "A")).toThrow(
        CalcPreconditionError,
      );
    });

    it("netCents négatif", () => {
      expect(() => computeShares(-1, [{ memberId: "A", pct: 100 }], "A")).toThrow(
        CalcPreconditionError,
      );
    });

    it("ratio vide", () => {
      expect(() => computeShares(1000, [], "A")).toThrow(CalcPreconditionError);
    });
  });
});
