// Vue admin brute des dépenses (T-C8.2, DA14) : consultation + correction d'une
// dépense verrouillée (T-C8.3). Aucun terme de vocabulaire membre à respecter
// ici (§8.1 ne s'applique qu'aux écrans membres).

import { getCurrentContext } from "../../lib/auth/context";
import { getAdminExpenseOverviewAction } from "../actions";
import { getDefaultShares } from "../../lib/household";
import { AdminExpenseTable } from "./admin-expense-table";
import { Card } from "../_components/design-system/core";
import { Notice } from "../_components/design-system/feedback";
import { Stack, PageTitle } from "../_components/design-system/layout";

export default async function AdminPage() {
  const ctx = await getCurrentContext();
  const [overviewResult, members] = await Promise.all([
    getAdminExpenseOverviewAction(),
    getDefaultShares(ctx.supabase, ctx.householdId),
  ]);

  // max-width élargi (T-CD3) : la colonne mobile-app par défaut (base.css,
  // 480px) est pensée pour les écrans membres — un tableau admin à 8 colonnes
  // a besoin de plus de largeur avant de retomber sur le scroll horizontal de
  // la Card.
  if (!overviewResult.ok) {
    return (
      <main style={{ maxWidth: "960px" }}>
        <Stack gap={4}>
          <PageTitle>Administration — dépenses</PageTitle>
          <Card>
            <Notice tone="error">{overviewResult.error.message}</Notice>
          </Card>
        </Stack>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: "960px" }}>
      <Stack gap={4}>
        <PageTitle>Administration — dépenses (vue brute)</PageTitle>
        <AdminExpenseTable initialLines={overviewResult.data} members={members} />
      </Stack>
    </main>
  );
}
