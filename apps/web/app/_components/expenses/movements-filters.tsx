"use client";

// Filtre mois (principal) + catégorie (secondaire, replié par défaut — même
// principe que le disclosure "détail à la demande" du solde) sur l'écran
// /mouvements complet (T-CN3.2). Navigation par `router.replace` sur les
// searchParams : re-rendu ciblé de la page (RSC), jamais un rechargement du
// document — le filtrage lui-même reste server-side (`listExpensesAction`).

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Category } from "@app/domain-expense";
import { CATEGORIES, categoryLabelOf } from "./categories";
import { CategoryChip } from "../design-system/balance";
import { Button } from "../design-system/core";
import nativeSelectStyles from "../design-system/core/native-select.module.css";
import { Stack } from "../design-system/layout";

const ALL_MONTHS = "tous";

type Props = {
  months: { value: string; label: string }[];
  month: string;
  category?: Category;
};

export function MovementsFilters({ months, month, category }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [categoryOpen, setCategoryOpen] = useState(false);

  function navigate(nextMonth: string, nextCategory?: Category) {
    const params = new URLSearchParams();
    if (nextMonth !== ALL_MONTHS) params.set("mois", nextMonth);
    if (nextCategory) params.set("categorie", nextCategory);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <Stack gap={2}>
      <label className={nativeSelectStyles.wrapper}>
        <span className={nativeSelectStyles.label}>mois</span>
        <select
          className={nativeSelectStyles.select}
          value={month}
          onChange={(e) => navigate(e.target.value, category)}
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <div>
        <Button variant="ghost" size="sm" onClick={() => setCategoryOpen((prev) => !prev)}>
          {category ? `catégorie : ${categoryLabelOf(category).toLowerCase()}` : "filtrer par catégorie"}
        </Button>
      </div>

      {categoryOpen ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-2)" }}>
          <button
            type="button"
            aria-pressed={!category}
            onClick={() => navigate(month, undefined)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontSize: "var(--text-sm)",
              color: category ? "var(--text-secondary)" : "var(--text-primary)",
              fontWeight: category ? "var(--weight-regular)" : "var(--weight-medium)",
            }}
          >
            toutes
          </button>
          {CATEGORIES.map((c) => (
            <CategoryChip
              key={c.value}
              name={c.label}
              size={28}
              selected={category === c.value}
              onClick={() => navigate(month, c.value)}
            />
          ))}
        </div>
      ) : null}
    </Stack>
  );
}
