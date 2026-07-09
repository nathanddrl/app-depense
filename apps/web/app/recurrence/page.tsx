// Écran « charges récurrentes » (spec ch.5.4, T-CR1). Pour l'instant, seul le
// formulaire de création existe — la liste/édition/désactivation arrive avec
// T-CR2 (`recurring-template-list.tsx`, non fait).

import { getCurrentContext } from "../../lib/auth/context";
import { getDefaultShares } from "../../lib/household";
import { RecurringTemplateForm } from "../_components/recurrence/recurring-template-form";
import { Stack, PageTitle } from "../_components/design-system/layout";

export default async function RecurrencePage() {
  const ctx = await getCurrentContext();
  const defaultShares = await getDefaultShares(ctx.supabase, ctx.householdId);

  return (
    <main>
      <Stack gap={4}>
        <PageTitle>charges récurrentes</PageTitle>
        <RecurringTemplateForm currentMemberId={ctx.member.id} defaultShares={defaultShares} />
      </Stack>
    </main>
  );
}
