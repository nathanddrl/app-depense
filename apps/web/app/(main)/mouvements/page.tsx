import type { Category } from "@app/domain-expense";
import { getCurrentContext } from "../../../lib/auth/context";
import { getDefaultShares } from "../../../lib/household";
import { listExpensesAction } from "../../actions";
import { CATEGORIES } from "../../_components/expenses/categories";
import { currentMonthKey, monthLabel, recentMonthKeys } from "../../_components/expenses/date-label";
import { MovementsFilters } from "../../_components/expenses/movements-filters";
import { MovementsList } from "../../_components/expenses/movements-list";
import { Notice } from "../../_components/design-system/feedback";
import { Stack, PageTitle } from "../../_components/design-system/layout";

const ALL_MONTHS = "tous";

type Props = {
  searchParams: Promise<{ mois?: string; categorie?: string }>;
};

// Historique complet (T-CN3.1), filtré par mois (défaut : mois courant) et
// catégorie (T-CN3.2) — filtre porté par les searchParams, appliqué en base
// via `listExpensesAction` (pas de filtrage en mémoire). Un seul mois
// sélectionné : regroupement par jour (plus fin, cohérent avec un mois
// unique) ; "tous les mois" : regroupement par mois comme posé en T-CN3.1.
export default async function MouvementsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const month = sp.mois ?? currentMonthKey();
  const category = CATEGORIES.some((c) => c.value === sp.categorie) ? (sp.categorie as Category) : undefined;

  const ctx = await getCurrentContext();
  const [expensesResult, defaultShares] = await Promise.all([
    listExpensesAction({ month: month === ALL_MONTHS ? undefined : month, category }),
    getDefaultShares(ctx.supabase, ctx.householdId),
  ]);

  const months = [
    { value: ALL_MONTHS, label: "tous les mois" },
    ...recentMonthKeys(12).map((key) => ({ value: key, label: monthLabel(key) })),
  ];

  return (
    <main>
      <Stack gap={4}>
        <PageTitle>mouvements</PageTitle>
        <MovementsFilters months={months} month={month} category={category} />
        {!expensesResult.ok ? (
          <Notice tone="error">{expensesResult.error.message}</Notice>
        ) : expensesResult.data.length === 0 ? (
          <Notice>aucune dépense pour ce filtre</Notice>
        ) : (
          <MovementsList
            expenses={expensesResult.data}
            members={defaultShares}
            currentMemberId={ctx.member.id}
            groupBy={month === ALL_MONTHS ? "month" : "day"}
          />
        )}
      </Stack>
    </main>
  );
}
