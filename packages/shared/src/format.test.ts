import { describe, it, expect } from "vitest";
import { formatAmountEUR, formatDateFr } from "./index";

// Intl insère une espace fine insécable (U+202F) avant « € » selon la version
// d'ICU. On normalise les espaces pour tester la partie signifiante sans se lier
// au caractère exact.
const normalize = (s: string) => s.replace(/\s/g, " ");

describe("formatAmountEUR — centimes entiers → euro FR (DA10)", () => {
  it("formate un montant courant", () => {
    expect(normalize(formatAmountEUR(80000))).toBe("800,00 €");
  });

  it("formate 100 € (5000 c → dépense de référence 5.6)", () => {
    expect(normalize(formatAmountEUR(10000))).toBe("100,00 €");
  });

  it("formate zéro et les petits montants", () => {
    expect(normalize(formatAmountEUR(0))).toBe("0,00 €");
    expect(normalize(formatAmountEUR(1))).toBe("0,01 €");
  });
});

describe("formatDateFr — date métier en heure de Paris (D4)", () => {
  it("formate en jj/mm/aaaa", () => {
    expect(formatDateFr(new Date("2026-07-04T10:00:00Z"))).toBe("04/07/2026");
  });

  it("reste en date de Paris juste avant minuit UTC", () => {
    // 23:30 Paris (été = UTC+2) le 4 juillet → toujours le 04/07 côté Paris.
    expect(formatDateFr(new Date("2026-07-04T21:30:00Z"))).toBe("04/07/2026");
  });
});
