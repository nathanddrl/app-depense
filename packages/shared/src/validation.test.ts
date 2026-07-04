import { describe, it, expect } from "vitest";
import {
  validateAmountCents,
  validateRatio,
  validateIncurredOn,
  validateLabel,
  firstError,
} from "./index";

describe("validateAmountCents (ch.7 — montant brut entier > 0)", () => {
  it("accepte un entier positif", () => {
    expect(validateAmountCents(80000)).toBeNull();
    expect(validateAmountCents(1)).toBeNull();
  });

  it("refuse 0 et négatif", () => {
    expect(validateAmountCents(0)?.code).toBe("VALIDATION_ERROR");
    expect(validateAmountCents(-100)?.code).toBe("VALIDATION_ERROR");
  });

  it("refuse un flottant", () => {
    const e = validateAmountCents(100.5);
    expect(e?.code).toBe("VALIDATION_ERROR");
    expect(e?.field).toBe("grossCents");
  });
});

describe("validateRatio (ch.7 — chaque pct ≥ 0, Σ = 100)", () => {
  it("accepte 50/50 et 70/30", () => {
    expect(
      validateRatio([
        { memberId: "A", pct: 50 },
        { memberId: "B", pct: 50 },
      ]),
    ).toBeNull();
    expect(
      validateRatio([
        { memberId: "A", pct: 70 },
        { memberId: "B", pct: 30 },
      ]),
    ).toBeNull();
  });

  it("accepte 100/0 (une seule personne assume, 4.7)", () => {
    expect(
      validateRatio([
        { memberId: "A", pct: 100 },
        { memberId: "B", pct: 0 },
      ]),
    ).toBeNull();
  });

  it("refuse une somme ≠ 100", () => {
    const e = validateRatio([
      { memberId: "A", pct: 60 },
      { memberId: "B", pct: 30 },
    ]);
    expect(e?.code).toBe("VALIDATION_ERROR");
    expect(e?.field).toBe("shares");
  });

  it("refuse un pct négatif", () => {
    expect(
      validateRatio([
        { memberId: "A", pct: 120 },
        { memberId: "B", pct: -20 },
      ])?.code,
    ).toBe("VALIDATION_ERROR");
  });

  it("refuse un partage vide", () => {
    expect(validateRatio([])?.code).toBe("VALIDATION_ERROR");
  });
});

describe("validateIncurredOn (ch.7 — date requise, format date)", () => {
  it("accepte une date ISO valide", () => {
    expect(validateIncurredOn("2026-07-04")).toBeNull();
  });

  it("refuse une chaîne vide ou un mauvais format", () => {
    expect(validateIncurredOn("")?.code).toBe("VALIDATION_ERROR");
    expect(validateIncurredOn("04/07/2026")?.code).toBe("VALIDATION_ERROR");
  });

  it("refuse une date calendaire impossible", () => {
    expect(validateIncurredOn("2026-02-30")?.code).toBe("VALIDATION_ERROR");
  });
});

describe("validateLabel", () => {
  it("accepte un libellé non vide", () => {
    expect(validateLabel("Loyer")).toBeNull();
  });

  it("refuse une chaîne vide ou d'espaces", () => {
    expect(validateLabel("")?.code).toBe("VALIDATION_ERROR");
    expect(validateLabel("   ")?.field).toBe("label");
  });
});

describe("firstError — court-circuit", () => {
  it("renvoie null si tout est valide", () => {
    expect(firstError(null, null, null)).toBeNull();
  });

  it("renvoie la première erreur rencontrée", () => {
    const first = { code: "VALIDATION_ERROR" as const, message: "1", field: "a" };
    const second = { code: "NOT_FOUND" as const, message: "2" };
    expect(firstError(null, first, second)).toBe(first);
  });
});
