import { describe, expect, it } from "vitest";
import { parseAmountToCents } from "./amount";

describe("parseAmountToCents", () => {
  it("convertit un entier en centimes", () => {
    expect(parseAmountToCents("12")).toBe(1200);
  });

  it("accepte la virgule décimale (FR)", () => {
    expect(parseAmountToCents("12,50")).toBe(1250);
  });

  it("accepte le point décimal", () => {
    expect(parseAmountToCents("12.50")).toBe(1250);
  });

  it("tolère les espaces autour de la valeur", () => {
    expect(parseAmountToCents("  7,20  ")).toBe(720);
  });

  it("arrondit au centime le plus proche", () => {
    expect(parseAmountToCents("12,999")).toBe(1300);
  });

  it("renvoie null sur une chaîne vide", () => {
    expect(parseAmountToCents("")).toBeNull();
  });

  it("renvoie null sur une saisie non numérique", () => {
    expect(parseAmountToCents("abc")).toBeNull();
  });
});
