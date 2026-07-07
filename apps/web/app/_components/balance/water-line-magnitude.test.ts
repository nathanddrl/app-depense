import { describe, expect, it } from "vitest";
import { waterLineMagnitude } from "./water-line-magnitude";

describe("waterLineMagnitude — normalisation du solde pour WaterLine (T-CD2.1)", () => {
  it("solde nul → magnitude 0, quel que soit le signe déclaré", () => {
    expect(waterLineMagnitude(0, true)).toBe(0);
    expect(waterLineMagnitude(0, false)).toBe(0);
  });

  it("créancier → magnitude positive", () => {
    expect(waterLineMagnitude(7_500, true)).toBeCloseTo(0.5);
  });

  it("débiteur → magnitude négative", () => {
    expect(waterLineMagnitude(7_500, false)).toBeCloseTo(-0.5);
  });

  it("plafonne à ±1 au-delà du montant de référence (150 €)", () => {
    expect(waterLineMagnitude(30_000, true)).toBe(1);
    expect(waterLineMagnitude(30_000, false)).toBe(-1);
  });

  it("atteint tout juste ±1 exactement à 150 €", () => {
    expect(waterLineMagnitude(15_000, true)).toBe(1);
    expect(waterLineMagnitude(15_000, false)).toBe(-1);
  });
});
