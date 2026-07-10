// Logique pure de BottomNav (navigation-ia §1.3 / §3.2), isolée du rendu pour
// être testable sans DOM — même parti pris que category-color.ts / water-line-
// geometry.ts. Le composant BottomNav n'encode aucune règle métier lui-même.

// Valeur de l'item « ajouter » : c'est une action, pas une destination
// persistante. Il déclenche onAddPress et ne porte jamais l'état actif.
export const NAV_ADD_VALUE = "ajouter";

// Un item est « actif » quand sa valeur correspond à l'écran courant — sauf
// « ajouter », qui n'est jamais actif même quand l'écran ajouter est ouvert.
export function isNavItemActive(itemValue: string, active: string): boolean {
  if (itemValue === NAV_ADD_VALUE) return false;
  return itemValue === active;
}
