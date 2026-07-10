// Logique de saisie du sélecteur bénéficiaire « Les 2 » (spec 5.2, D10, T-CR4,
// décision produit 09/07/2026 `decisions-techniques.md`) — partagée entre
// `aid-section.tsx` (dépenses ponctuelles) et `recurring-template-form.tsx`
// (aide récurrente). C'est un raccourci de SAISIE (appelle `addAid`/construit
// `aids[]` deux fois), pas un calcul de solde : calc-engine reste seul à
// calculer parts/plafond en aval, rien ici n'est réutilisé pour ça.
//
// Répartition 50/50 par défaut, indépendante du ratio de partage de la
// dépense (l'aide est un flux perçu, pas la charge) : `floor(amount/2)` sur
// la 1ère ligne, reliquat sur la 2e — même règle d'arrondi déterministe que
// le reste du système (D5). Aucun centime perdu.

/** Sentinelle de valeur `<select>` — ne collisionne jamais avec un memberId (uuid). */
export const BOTH_BENEFICIARIES = "__both__";

/** `200€ → [100, 100]` ; `201€ → [100, 101]` (centimes entiers, D5). */
export function splitBothCents(amountCents: number): [number, number] {
  const first = Math.floor(amountCents / 2);
  return [first, amountCents - first];
}
