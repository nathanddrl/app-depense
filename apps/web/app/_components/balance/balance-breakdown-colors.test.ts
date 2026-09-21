import { describe, expect, it } from "vitest";
import {
  assignCategoryChartColors,
  getExpenseChartColorVar,
  getMemberChartColorVar,
} from "./balance-breakdown-colors";

// Enum `expense_category` (packages/db) — 11 valeurs pour une palette de 8.
const ALL_CATEGORIES = [
  "loyer",
  "courses",
  "charges",
  "sorties",
  "autre",
  "abonnements",
  "assurances",
  "transports",
  "animaux",
  "restos",
  "shopping",
];

describe("assignCategoryChartColors — parts d'un même donut jamais de la même couleur", () => {
  it("les paires qui collisionnaient par simple hash (charges/autre, courses/abonnements, loyer/animaux) restent distinctes", () => {
    for (const pair of [
      ["charges", "autre"],
      ["courses", "abonnements"],
      ["loyer", "animaux"],
      ["transports", "shopping"],
      ["assurances", "restos"],
    ]) {
      const [a, b] = assignCategoryChartColors(pair);
      expect(a).not.toBe(b);
    }
  });

  it("jusqu'à 8 catégories : toutes des couleurs différentes, quelles qu'elles soient", () => {
    for (let start = 0; start + 8 <= ALL_CATEGORIES.length + 1; start++) {
      const subset = ALL_CATEGORIES.slice(start, start + 8);
      if (subset.length < 8) continue;
      expect(new Set(assignCategoryChartColors(subset)).size).toBe(8);
    }
  });

  it("les 11 catégories : les 8 couleurs sont toutes utilisées, réutilisation seulement à partir de la 9e", () => {
    const colors = assignCategoryChartColors(ALL_CATEGORIES);
    expect(new Set(colors.slice(0, 8)).size).toBe(8);
    expect(colors).toHaveLength(11);
  });

  it("déterministe : même liste, mêmes couleurs", () => {
    expect(assignCategoryChartColors(["charges", "autre", "loyer"])).toEqual(
      assignCategoryChartColors(["charges", "autre", "loyer"]),
    );
  });

  it("une catégorie sans collision garde la même couleur d'un donut à l'autre", () => {
    const [seule] = assignCategoryChartColors(["sorties"]);
    const [enPremier] = assignCategoryChartColors(["sorties", "loyer"]);
    expect(seule).toBe(enPremier);
  });

  it("liste vide → aucune couleur", () => {
    expect(assignCategoryChartColors([])).toEqual([]);
  });
});

describe("autres niveaux", () => {
  it("niveau 3 : jusqu'à 8 dépenses d'une catégorie, toutes des couleurs différentes", () => {
    const colors = Array.from({ length: 8 }, (_, i) => getExpenseChartColorVar("loyer", i));
    expect(new Set(colors).size).toBe(8);
  });

  it("niveau 1 : les deux membres n'ont jamais la même couleur", () => {
    expect(getMemberChartColorVar(0)).not.toBe(getMemberChartColorVar(1));
  });

  it("toutes les couleurs pointent vers un token --chart-N existant (1 à 8)", () => {
    const all = [
      ...assignCategoryChartColors(ALL_CATEGORIES),
      getMemberChartColorVar(0),
      getMemberChartColorVar(1),
      ...Array.from({ length: 12 }, (_, i) => getExpenseChartColorVar("courses", i)),
    ];
    for (const c of all) expect(c).toMatch(/^var\(--chart-[1-8]\)$/);
  });
});
