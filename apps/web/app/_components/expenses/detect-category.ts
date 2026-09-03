// Détection automatique de catégorie à partir du libellé saisi (spec-technique
// §6, « catégorie devinée si possible »). Heuristique statique, frontend only :
// aucun appel réseau, aucun apprentissage depuis l'historique.
//
// Le dictionnaire ci-dessous est la seule chose à éditer pour ajouter/retirer
// un mot-clé — la logique de matching n'en dépend pas. Les clés sont les
// valeurs de l'enum `expense_category` (D18) ; `autre` n'en a volontairement
// aucune : c'est le repli par défaut, jamais un match positif.

import type { Category } from "@app/domain-expense";
import { CATEGORIES } from "./categories";

export const CATEGORY_KEYWORDS: Partial<Record<Category, string[]>> = {
  loyer: ["loyer", "rent"],
  charges: ["edf", "engie", "électricité", "eau", "gaz", "énergie"],
  abonnements: [
    "internet",
    "box",
    "netflix",
    "spotify",
    "disney+",
    "canal+",
    "abonnement",
    "forfait",
  ],
  assurances: ["assurance", "mutuelle"],
  courses: [
    "courses",
    "supermarché",
    "carrefour",
    "leclerc",
    "lidl",
    "monoprix",
    "auchan",
    "intermarché",
    "franprix",
    "casino",
    "picard",
    "biocoop",
  ],
  transports: [
    "essence",
    "carburant",
    "sncf",
    "train",
    "métro",
    "bus",
    "parking",
    "péage",
    "uber",
    "taxi",
    "blablacar",
  ],
  animaux: ["véto", "vétérinaire", "croquettes", "animalerie"],
  sorties: ["sortie", "ciné", "cinéma", "concert", "expo", "bar", "soirée"],
  restos: [
    "resto",
    "restaurant",
    "bistrot",
    "brasserie",
    "mcdo",
    "uber eats",
    "deliveroo",
    "kebab",
    "pizza",
  ],
  shopping: ["shopping", "vêtements", "zara", "h&m", "amazon", "decathlon"],
};

/** Minuscules + accents retirés : « Électricité » et « electricite » matchent pareil. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Alphanumérique au sens large (accents déjà retirés par `normalize`). */
function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[a-z0-9]/.test(char);
}

// Match sur mot entier, pas simple `includes` : sinon « eau » (charges)
// matcherait « cadeau » ou « bureau ». Les bords non alphanumériques du
// mot-clé lui-même restent tolérés (« disney+ », « h&m », « uber eats »).
function containsKeyword(haystack: string, keyword: string): boolean {
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(keyword, from);
    if (at === -1) return false;
    const before = haystack[at - 1];
    const after = haystack[at + keyword.length];
    const startOk = !isWordChar(before) || !isWordChar(keyword[0]);
    const endOk = !isWordChar(after) || !isWordChar(keyword[keyword.length - 1]);
    if (startOk && endOk) return true;
    from = at + 1;
  }
}

/**
 * Catégorie devinée depuis le libellé, ou `null` si aucun mot-clé ne matche
 * (l'appelant garde alors la valeur courante — jamais de repli sur `autre`).
 *
 * En cas de matchs multiples, le mot-clé le PLUS LONG gagne : « Uber Eats »
 * doit tomber sur `restos` et non sur `transports` (« uber »). À longueur
 * égale, l'ordre de `CATEGORIES` (source de vérité, D18) tranche.
 */
export function detectCategory(label: string): Category | null {
  const haystack = normalize(label);
  if (!haystack) return null;

  let best: { category: Category; length: number } | null = null;

  for (const { value } of CATEGORIES) {
    for (const keyword of CATEGORY_KEYWORDS[value] ?? []) {
      const normalized = normalize(keyword);
      if (!containsKeyword(haystack, normalized)) continue;
      if (best === null || normalized.length > best.length) {
        best = { category: value, length: normalized.length };
      }
    }
  }

  return best?.category ?? null;
}
