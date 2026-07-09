// Catégories de dépense (enum DB, D18) : source unique du libellé FR affiché,
// partagée entre le formulaire de création et l'historique.

import type { Category } from "@app/domain-expense";

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "loyer", label: "Loyer" },
  { value: "courses", label: "Courses" },
  { value: "charges", label: "Charges" },
  { value: "sorties", label: "Sorties" },
  { value: "autre", label: "Autre" },
];

export function categoryLabelOf(value: Category): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
