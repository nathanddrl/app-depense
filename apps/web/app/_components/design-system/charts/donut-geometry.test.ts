import { describe, it, expect } from "vitest";
import {
  computeSliceAngles,
  sliceMidAngle,
  annularSectorPath,
  labelRotation,
  cubicBezierEase,
  MIN_SLICE_FRACTION,
} from "./donut-geometry";

describe("computeSliceAngles", () => {
  it("deux parts égales → 180° chacune, cercle complet", () => {
    const slices = computeSliceAngles([
      { id: "a", valueCents: 100 },
      { id: "b", valueCents: 100 },
    ]);
    expect(slices[0].endAngle - slices[0].startAngle).toBeCloseTo(180, 5);
    expect(slices[1].endAngle - slices[1].startAngle).toBeCloseTo(180, 5);
    expect(slices[1].startAngle).toBeCloseTo(slices[0].endAngle, 5);
    expect(slices[0].startAngle).toBe(-90); // 12h
  });

  it("proportions respectées pour des valeurs quelconques", () => {
    const slices = computeSliceAngles([
      { id: "a", valueCents: 300 },
      { id: "b", valueCents: 100 },
    ]);
    const widthA = slices[0].endAngle - slices[0].startAngle;
    const widthB = slices[1].endAngle - slices[1].startAngle;
    expect(widthA).toBeCloseTo(270, 5);
    expect(widthB).toBeCloseTo(90, 5);
  });

  it("part sous 2 % remontée au plancher, l'excédent repris sur les autres", () => {
    const slices = computeSliceAngles([
      { id: "big1", valueCents: 4900 },
      { id: "big2", valueCents: 4900 },
      { id: "tiny", valueCents: 200 }, // 2% pile — pas de plancher nécessaire
    ]);
    const widths = slices.map((s) => s.endAngle - s.startAngle);
    // 200/10000 = 2% exactement → pas de plancher déclenché ici.
    expect(widths[2]).toBeCloseTo(MIN_SLICE_FRACTION * 360, 1);

    const withReallyTiny = computeSliceAngles([
      { id: "big1", valueCents: 4950 },
      { id: "big2", valueCents: 4950 },
      { id: "tiny", valueCents: 100 }, // 1% < 2% → plancher
    ]);
    const tinyWidth = withReallyTiny[2].endAngle - withReallyTiny[2].startAngle;
    expect(tinyWidth).toBeCloseTo(MIN_SLICE_FRACTION * 360, 1);
    // Le total reste 360° (les grandes parts ont cédé l'excédent).
    const total = withReallyTiny.reduce((s, sl) => s + (sl.endAngle - sl.startAngle), 0);
    expect(total).toBeCloseTo(360, 5);
  });

  it("membre à 0 (aucune dépense sur la période) reste visible au plancher — niveau 1", () => {
    const slices = computeSliceAngles([
      { id: "a", valueCents: 10000 },
      { id: "b", valueCents: 0 },
    ]);
    const widthB = slices[1].endAngle - slices[1].startAngle;
    expect(widthB).toBeCloseTo(MIN_SLICE_FRACTION * 360, 1);
    expect(widthB).toBeGreaterThan(0);
  });

  it("liste vide → aucune part, ne plante pas", () => {
    expect(computeSliceAngles([])).toEqual([]);
  });

  it("total à 0 sur plusieurs parts (défensif) → parts égales, ne divise pas par 0", () => {
    const slices = computeSliceAngles([
      { id: "a", valueCents: 0 },
      { id: "b", valueCents: 0 },
    ]);
    expect(slices).toHaveLength(2);
    expect(Number.isFinite(slices[0].endAngle)).toBe(true);
  });
});

describe("sliceMidAngle", () => {
  it("milieu de l'intervalle", () => {
    expect(sliceMidAngle({ startAngle: -90, endAngle: 90 })).toBe(0);
  });
});

describe("annularSectorPath", () => {
  it("produit un chemin SVG bien formé (M/A/L/A/Z)", () => {
    const path = annularSectorPath(100, 100, 90, 50, -90, 90);
    expect(path.startsWith("M ")).toBe(true);
    expect(path).toContain(" A ");
    expect(path).toContain(" L ");
    expect(path.endsWith("Z")).toBe(true);
  });

  it("part unique à 360° (un seul membre a payé) ne casse pas le flag d'arc SVG", () => {
    const path = annularSectorPath(100, 100, 90, 50, -90, 270);
    // Ne doit pas contenir de coordonnées NaN.
    expect(path).not.toContain("NaN");
  });
});

describe("labelRotation — le libellé suit la tangente, jamais de débordement", () => {
  it("en haut (12h, angle -90°) : horizontal, pas de rotation", () => {
    expect(labelRotation(-90)).toBe(0);
  });

  it("en bas (6h, angle 90°) : horizontal, pas de rotation (retourné si nécessaire)", () => {
    expect(labelRotation(90)).toBe(0);
  });

  it("à droite (3h, angle 0°) : vertical, aligné sur la tangente", () => {
    expect(labelRotation(0)).toBe(90);
  });

  it("à gauche (9h, angle 180°) : vertical, jamais tête en bas", () => {
    // 180+90=270, dans la plage à retourner (90,270) exclue au bord → reste 270,
    // mais 270 n'est pas dans ]90,270[ (borne exclue) donc pas de flip ici :
    // valeur attendue = 270, un texte vertical lisible de bas en haut.
    expect(labelRotation(180)).toBe(270);
  });

  it("jamais de rotation dans la plage tête en bas (]90°, 270°[)", () => {
    for (let angle = -180; angle <= 180; angle += 15) {
      const rotation = labelRotation(angle);
      expect(rotation <= 90 || rotation >= 270).toBe(true);
    }
  });
});

describe("cubicBezierEase — même algorithme que --motion-settle-easing (CSS)", () => {
  const ease = cubicBezierEase(0.16, 1, 0.3, 1);

  it("borne à 0 en t=0 et 1 en t=1", () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
  });

  it("jamais d'overshoot (zéro rebond, contrainte non négociable) : y ∈ [0,1] pour t ∈ [0,1]", () => {
    for (let t = 0; t <= 1; t += 0.02) {
      const y = ease(t);
      expect(y).toBeGreaterThanOrEqual(-1e-6);
      expect(y).toBeLessThanOrEqual(1 + 1e-6);
    }
  });

  it("monotone croissante (décélération lourde, jamais de retour en arrière)", () => {
    let previous = -Infinity;
    for (let t = 0; t <= 1; t += 0.02) {
      const y = ease(t);
      expect(y).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = y;
    }
  });
});
