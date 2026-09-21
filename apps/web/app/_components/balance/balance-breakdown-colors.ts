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

/** Niveau 1 (membres) : ardoise et sarcelle — deux tons de la même famille
 * froide, distingués par la saturation. DESIGN.md interdit deux teintes
 * OPPOSÉES pour « les deux côtés » d'un écart (anti-réflexe Tricount) : ce
 * niveau représente les deux membres, jamais deux camps. Le nom sur l'arc et
 * la légende portent l'identification, pas l'opposition de couleur.
 * Assignation par ordre stable (ordre de `members`, jamais aléatoire). */
export function getMemberChartColorVar(memberIndex: number): string {
  return memberIndex % 2 === 0 ? chartColorVar(7) : chartColorVar(3);
}

/** Niveau 2 (catégories d'un membre) : couleur préférée = hash déterministe du
 * nom (même catégorie, même couleur d'un écran à l'autre), décalée sur la
 * suivante si une autre part du MÊME donut l'a déjà prise — un hash seul
 * fait collisionner 5 des 11 catégories (ex. charges/autre, courses/
 * abonnements), donc deux parts voisines indiscernables. Sans collision
 * jusqu'à 8 parts (la palette) ; au-delà, réutilisation inévitable.
 * `categories` est déjà trié de façon déterministe par le calc-engine. */
export function assignCategoryChartColors(categories: string[]): string[] {
  const taken = new Set<number>();
  return categories.map((category) => {
    let index = hashChartIndex(category);
    for (let step = 0; step < CHART_TOKEN_COUNT && taken.has(index); step++) {
      index = (index + 1) % CHART_TOKEN_COUNT;
    }
    taken.add(index);
    return chartColorVar(index);
  });
}

/** Niveau 3 (dépenses d'une catégorie) : cycle sur la palette, décalé par un
 * hash de la catégorie pour ne pas toujours démarrer à la même teinte. */
export function getExpenseChartColorVar(category: string, expenseIndex: number): string {
  return chartColorVar(hashChartIndex(category) + 1 + expenseIndex);
}
