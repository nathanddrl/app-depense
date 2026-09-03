import { describe, it, expect } from "vitest";
import { detectCategory, CATEGORY_KEYWORDS } from "./detect-category";
import { CATEGORIES } from "./categories";

describe("detectCategory", () => {
  it("devine la catégorie sur un libellé contenant le mot-clé", () => {
    expect(detectCategory("Loyer appartement")).toBe("loyer");
    expect(detectCategory("Carrefour")).toBe("courses");
    expect(detectCategory("Netflix")).toBe("abonnements");
  });

  it("ignore la casse et les accents dans les deux sens", () => {
    expect(detectCategory("ELECTRICITE janvier")).toBe("charges");
    expect(detectCategory("électricité janvier")).toBe("charges");
    expect(detectCategory("Ciné avec Léa")).toBe("sorties");
    expect(detectCategory("cine avec lea")).toBe("sorties");
  });

  it("rend null quand aucun mot-clé ne matche", () => {
    expect(detectCategory("")).toBeNull();
    expect(detectCategory("   ")).toBeNull();
    expect(detectCategory("cadeau anniversaire mamie")).toBeNull();
  });

  it("matche sur mot entier, pas sur une sous-chaîne", () => {
    // « eau » (charges) ne doit pas être trouvé dans « cadeau » / « bureau »
    expect(detectCategory("cadeau")).toBeNull();
    expect(detectCategory("chaise de bureau")).toBeNull();
    expect(detectCategory("facture eau")).toBe("charges");
  });

  it("tolère la ponctuation collée au mot-clé", () => {
    expect(detectCategory("Disney+")).toBe("abonnements");
    expect(detectCategory("H&M soldes")).toBe("shopping");
    expect(detectCategory("Resto, samedi soir")).toBe("restos");
  });

  it("préfère le mot-clé le plus long en cas d'ambiguïté", () => {
    expect(detectCategory("Uber")).toBe("transports");
    expect(detectCategory("Uber Eats vendredi")).toBe("restos");
  });

  it("n'a aucun mot-clé pour `autre` (repli par défaut, jamais un match)", () => {
    expect(CATEGORY_KEYWORDS.autre).toBeUndefined();
    expect(detectCategory("autre")).toBeNull();
  });

  it("n'indexe le dictionnaire que sur des valeurs de l'enum", () => {
    const known = CATEGORIES.map((c) => c.value);
    for (const key of Object.keys(CATEGORY_KEYWORDS)) {
      expect(known).toContain(key);
    }
  });
});
