import { describe, it, expect } from "vitest";
import { getCategoryColorVar, getCategoryInitial } from "./category-color";

describe("getCategoryColorVar", () => {
  it("même nom → même couleur, toujours (invariant déterministe, pas d'aléatoire)", () => {
    expect(getCategoryColorVar("Courses")).toBe(getCategoryColorVar("Courses"));
    expect(getCategoryColorVar("Loyer")).toBe(getCategoryColorVar("Loyer"));
  });

  it("reste toujours dans la sous-palette --category-1..6", () => {
    const names = ["Loyer", "Courses", "Charges", "Sorties", "Autre", "Internet", "Assurance", "Vacances"];
    for (const name of names) {
      expect(getCategoryColorVar(name)).toMatch(/^var\(--category-[1-6]\)$/);
    }
  });

  it("des noms différents peuvent produire des couleurs différentes (pas une constante figée)", () => {
    const names = ["Loyer", "Courses", "Charges", "Sorties", "Internet", "Assurance"];
    const colors = new Set(names.map(getCategoryColorVar));
    expect(colors.size).toBeGreaterThan(1);
  });
});

describe("getCategoryInitial", () => {
  it("retourne la première lettre du nom telle quelle, sans forçage de casse", () => {
    expect(getCategoryInitial("Courses")).toBe("C");
    expect(getCategoryInitial("courses")).toBe("c");
  });

  it("même nom → même initiale, toujours", () => {
    expect(getCategoryInitial("Loyer")).toBe(getCategoryInitial("Loyer"));
  });
});
