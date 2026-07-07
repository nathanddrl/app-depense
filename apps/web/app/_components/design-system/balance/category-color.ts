// Attribution automatique de CategoryChip (uiuix guide/06-iconographie.md) :
// même nom → même couleur et même initiale, toujours. Aucun aléatoire, aucun
// stockage — recalculé à chaque rendu à partir du nom seul. Pas de color
// picker manuel : décision tranchée du guide, jamais reconsidérée ici.

const CATEGORY_TOKEN_COUNT = 6;

/** Hash déterministe (djb2) : même chaîne → même index, toujours. */
function hashCategoryIndex(name: string): number {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 33 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % CATEGORY_TOKEN_COUNT;
}

export function getCategoryColorVar(name: string): string {
  return `var(--category-${hashCategoryIndex(name) + 1})`;
}

/** Première lettre du nom telle quelle — jamais de forçage de casse (DA10). */
export function getCategoryInitial(name: string): string {
  return name.charAt(0);
}
