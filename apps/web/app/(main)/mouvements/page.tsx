import { getCurrentContext } from "../../../lib/auth/context";
import { getDefaultShares } from "../../../lib/household";
import { listExpensesAction } from "../../actions";
import { MovementsList } from "../../_components/expenses/movements-list";
import { Notice } from "../../_components/design-system/feedback";
import { Stack, PageTitle } from "../../_components/design-system/layout";

// Historique complet (T-CN3.1), lecture seule — groupé par mois (repère plus
// lisible qu'un séparateur par jour à l'échelle de plusieurs mois, contraire
// à `MovementsList` sur l'accueil qui reste par jour pour un extrait de 3
// lignes). Filtre mois/catégorie : T-CN3.2, pas ici.
export default async function MouvementsPage() {
  const ctx = await getCurrentContext();
  const [expensesResult, defaultShares] = await Promise.all([
    listExpensesAction(),
    getDefaultShares(ctx.supabase, ctx.householdId),
  ]);

  return (
    <main>
      <Stack gap={4}>
        <PageTitle>mouvements</PageTitle>
        {!expensesResult.ok ? (
          <Notice tone="error">{expensesResult.error.message}</Notice>
        ) : expensesResult.data.length === 0 ? (
          <Notice>aucune dépense pour le moment</Notice>
        ) : (
          <MovementsList expenses={expensesResult.data} members={defaultShares} groupBy="month" />
        )}
      </Stack>
    </main>
  );
}
