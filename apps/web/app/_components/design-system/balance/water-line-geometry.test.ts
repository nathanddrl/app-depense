import { describe, it, expect } from "vitest";
import { computeWaterLine } from "./water-line-geometry";

describe("computeWaterLine", () => {
  it("magnitude=0 → ligne droite (depth=0), couleur --color-balance-none", () => {
    const { depth, colorVar } = computeWaterLine(0, 320, 64);
    expect(depth).toBe(0);
    expect(colorVar).toBe("var(--color-balance-none)");
  });

  it("l'inflexion et la couleur progressent ensemble, sur les mêmes seuils (0 / 0.25 / 0.6)", () => {
    const cases: Array<[number, string]> = [
      [0.1, "var(--color-balance-subtle)"],
      [0.24, "var(--color-balance-subtle)"],
      [0.25, "var(--color-balance-moderate)"],
      [0.3, "var(--color-balance-moderate)"],
      [0.59, "var(--color-balance-moderate)"],
      [0.6, "var(--color-balance-ceiling)"],
      [0.7, "var(--color-balance-ceiling)"],
      [1, "var(--color-balance-ceiling)"],
    ];

    let previousDepth = 0;
    for (const [magnitude, expectedColor] of cases) {
      const { depth, colorVar } = computeWaterLine(magnitude, 320, 64);
      expect(colorVar).toBe(expectedColor);
      expect(depth).toBeGreaterThan(previousDepth);
      previousDepth = depth;
    }
  });

  it("plafonne l'amplitude au-delà de 1 (jamais de dépassement du plafond dur)", () => {
    const atCeiling = computeWaterLine(1, 320, 64);
    const beyond = computeWaterLine(2.5, 320, 64);
    expect(beyond.depth).toBe(atCeiling.depth);
    expect(beyond.colorVar).toBe(atCeiling.colorVar);
  });

  it("le signe inverse la direction de l'inflexion, jamais la couleur (une seule teinte, pas deux camps)", () => {
    const positive = computeWaterLine(0.4, 320, 64);
    const negative = computeWaterLine(-0.4, 320, 64);
    expect(positive.colorVar).toBe(negative.colorVar);
    expect(positive.depth).toBe(negative.depth);
    expect(positive.path).not.toBe(negative.path);
  });
});
