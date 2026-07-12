"use client";

// Sélecteur de catégorie mutualisé : `<select>` natif (classes partagées
// `native-select.module.css`) + aperçu `CategoryChip`, utilisé par
// `expense-form.tsx` et `recurring-template-form.tsx` (même pattern, avant
// dupliqué dans les deux). Select et chip sont des enfants flex du même
// conteneur (`alignItems: center`) plutôt que deux colonnes label+contenu
// séparées : le chip (32px) et le select (hauteur dépendante du line-height)
// se centrent l'un sur l'autre quelle que soit leur hauteur réelle, au lieu
// d'être mal alignés verticalement (T-CD3, bug observé sur mobile).

import { CATEGORIES } from "./categories";
import { CategoryChip } from "../design-system/balance";
import nativeSelectStyles from "../design-system/core/native-select.module.css";

type Category = (typeof CATEGORIES)[number]["value"];

type Props = {
  value: Category;
  onChange: (value: Category) => void;
};

export function CategorySelect({ value, onChange }: Props) {
  return (
    <div className={nativeSelectStyles.wrapper}>
      <span className={nativeSelectStyles.label}>catégorie</span>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <select
          className={nativeSelectStyles.select}
          value={value}
          onChange={(e) => onChange(e.target.value as Category)}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <CategoryChip name={CATEGORIES.find((c) => c.value === value)?.label ?? value} />
      </div>
    </div>
  );
}
