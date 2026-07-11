import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

// Verrou anti-régression (WaterLine v2, encodage directionnel) : `-text` est
// calibré pour un contraste de lecture (WCAG AA), `-subtle/-moderate/-ceiling`
// pour un poids de trait graphique — deux échelles indépendantes qui ne
// doivent jamais se substituer l'une à l'autre. Pas de rendu React ici
// (environnement Vitest "node", pas de DOM) : on verrouille directement le
// mapping CSS, seul point qui pourrait glisser vers `-ceiling` par erreur.
const css = readFileSync(new URL("./AmountDisplay.module.css", import.meta.url), "utf-8");

function ruleFor(className: string): string {
  const match = css.match(new RegExp(`\\.${className}\\s*{([^}]*)}`));
  if (!match) throw new Error(`règle .${className} introuvable dans AmountDisplay.module.css`);
  return match[1];
}

describe("AmountDisplay — tons balance", () => {
  it("balance-negative consomme exclusivement --color-balance-negative-text", () => {
    const rule = ruleFor("balance-negative");
    expect(rule).toContain("--color-balance-negative-text");
    expect(rule).not.toMatch(/--color-balance-negative-(subtle|moderate|ceiling)/);
  });

  it("balance-positive consomme exclusivement --color-balance-positive-text", () => {
    const rule = ruleFor("balance-positive");
    expect(rule).toContain("--color-balance-positive-text");
    expect(rule).not.toMatch(/--color-balance-positive-(subtle|moderate|ceiling)/);
  });
});
