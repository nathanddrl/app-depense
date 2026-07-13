"use client";

// Invitation à paramétrer le loyer (spec 8.6, T-C9.1) : visible tant qu'aucun
// template de charge récurrente actif n'existe (page.tsx,
// `showRecurrenceInvite`), masquée dès qu'un template existe —
// `listRecurringTemplates` ne remonte que les templates `active = true`. Même
// ton que `first-expense-invite.tsx` : constat factuel + CTA infinitif.
// Ouvre l'écran ajouter en mode récurrent (T-CN2.2, remplace /recurrence) :
// intention transmise via ?mode=recurrent, non exploitée avant le câblage du
// Tabs en T-CN4.2.

import { useRouter } from "next/navigation";
import { Card, Button } from "../design-system/core";
import { Notice, useGlobalTransition } from "../design-system/feedback";
import { Stack } from "../design-system/layout";
import { ADD_MODE_PARAM, ADD_MODE_RECURRENT } from "../add/add-mode";

export function RecurrenceInvite() {
  const router = useRouter();
  const [, startTransition] = useGlobalTransition();

  return (
    <Card>
      <Stack gap={2}>
        <Notice>aucune charge récurrente n&apos;est encore paramétrée</Notice>
        <Button
          variant="primary"
          onClick={() =>
            startTransition(() => router.push(`/ajouter?${ADD_MODE_PARAM}=${ADD_MODE_RECURRENT}`))
          }
        >
          paramétrer le loyer
        </Button>
      </Stack>
    </Card>
  );
}
