// Écran « charges récurrentes » (spec ch.5.4, T-CR1/T-CR2) : formulaire de
// création + liste des récurrences actives (édition du montant, désactivation).

import Link from "next/link";
import { getCurrentContext } from "../../lib/auth/context";
import { getDefaultShares } from "../../lib/household";
import { listRecurringTemplatesAction } from "../actions";
import { RecurringTemplateForm } from "../_components/recurrence/recurring-template-form";
import { RecurringTemplateList } from "../_components/recurrence/recurring-template-list";
import { WaterSeparator } from "../_components/design-system/navigation";
import { Stack, PageTitle } from "../_components/design-system/layout";
import { Notice } from "../_components/design-system/feedback";

export default async function RecurrencePage() {
  const ctx = await getCurrentContext();
  const [defaultShares, templatesResult] = await Promise.all([
    getDefaultShares(ctx.supabase, ctx.householdId),
    listRecurringTemplatesAction(),
  ]);

  return (
    <main>
      <Stack gap={4}>
        <Link href="/" style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          ← retour
        </Link>
        <PageTitle>charges récurrentes</PageTitle>
        <RecurringTemplateForm currentMemberId={ctx.member.id} defaultShares={defaultShares} />
        <WaterSeparator />
        {templatesResult.ok ? (
          <RecurringTemplateList
            currentMemberId={ctx.member.id}
            defaultShares={defaultShares}
            templates={templatesResult.data}
          />
        ) : (
          <Notice tone="error">{templatesResult.error.message}</Notice>
        )}
      </Stack>
    </main>
  );
}
