// Palette du donut de répartition (écran « d'où vient l'écart », refonte
// solde) — DÉLIBÉRÉMENT distincte de `design-system/balance/category-color.ts`
// (demande explicite : les 6 tokens `--category-*` sont trop proches en teinte
// pour distinguer plusieurs parts adjacentes sur un même graphique — bon pour
// un petit chip isolé, pas pour un camembert). Même mécanisme (hash
// déterministe, aucun stockage) que le kit existant, recalibré sur
// `--chart-1..8` (chroma élevé, teintes réparties sur tout le cercle).

const CHART_TOKEN_COUNT = 8;

function hashChartIndex(key: string): number {
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 33 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % CHART_TOKEN_COUNT;
}

function chartColorVar(index: number): string {
  return `var(--chart-${(index % CHART_TOKEN_COUNT) + 1})`;
}

/** Niveau 1 (membres) : deux teintes aux antipodes du cercle chromatique — le
 * plus grand contraste possible entre les deux seules parts de ce niveau.
 * Assignation par ordre stable (ordre de `members`, jamais aléatoire). */
export function getMemberChartColorVar(memberIndex: number): string {
  return memberIndex % 2 === 0 ? chartColorVar(4) : chartColorVar(0);
}

/** Niveau 2 (catégories d'un membre) : hash déterministe sur le nom, même
 * principe que `getCategoryColorVar` mais palette propre à ce graphique. */
export function getCategoryChartColorVar(category: string): string {
  return chartColorVar(hashChartIndex(category));
}

/** Niveau 3 (dépenses d'une catégorie) : cycle sur la palette, décalé par un
 * hash de la catégorie pour ne pas toujours démarrer à la même teinte. */
export function getExpenseChartColorVar(category: string, expenseIndex: number): string {
  return chartColorVar(hashChartIndex(category) + 1 + expenseIndex);
}
