// Catégories de dépense (enum DB, D18) : source unique du libellé FR affiché,
// partagée entre le formulaire de création et l'historique.

import type { Category } from "@app/domain-expense";

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "loyer", label: "Loyer" },
  { value: "charges", label: "Charges" },
  { value: "abonnements", label: "Abonnements" },
  { value: "assurances", label: "Assurances" },
  { value: "courses", label: "Courses" },
  { value: "transports", label: "Transports" },
  { value: "animaux", label: "Animaux" },
  { value: "sorties", label: "Sorties" },
  { value: "restos", label: "Restos" },
  { value: "shopping", label: "Shopping" },
  { value: "autre", label: "Autre" },
];

export function categoryLabelOf(value: Category): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
