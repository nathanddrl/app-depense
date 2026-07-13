"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RecurringTemplate } from "@app/domain-recurrence";
import { createExpenseAction, addAidAction } from "../../actions";
import type { MemberShare } from "../../../lib/household";
import { ExpenseForm, type NewExpenseInput } from "../expenses/expense-form";
import { BOTH_BENEFICIARIES, splitBothCents } from "../expenses/aid-split";
import { RecurringTemplateForm } from "../recurrence/recurring-template-form";
import { RecurringTemplateList } from "../recurrence/recurring-template-list";
import { ADD_MODE_ONCE, ADD_MODE_RECURRENT } from "./add-mode";
import { Button } from "../design-system/core";
import { Dialog, useGlobalTransition } from "../design-system/feedback";
import { Tabs, WaterSeparator } from "../design-system/navigation";
import { Stack } from "../design-system/layout";

// Shell de l'écran « ajouter » (navigation-ia §1.3/§3.3), partagé par les deux
// points d'entrée : la route interceptée (@modal/(.)ajouter) et le repli plein
// écran (/ajouter). onClose vient de l'appelant : back() pour l'interception
// (retour exact à l'origine), accueil pour le repli direct.
//
// Bascule ponctuel/récurrent (T-CN4.2, premier usage réel de `Tabs`,
// T-CD1.4) : `initialMode` vient de `?mode=recurrent` (T-CN2.2, CTA de
// `recurrence-invite.tsx`), la suite est un changement d'onglet in-place
// (état local, pas de navigation). Composition du mode récurrent posée en
// T-CN4.3 (`RecurringMode` ci-dessous) : la route dédiée `/recurrence` est
// supprimée, cet écran devient l'unique point d'entrée.
//
// Orchestration du mode « une fois » reprise telle quelle de l'ancien
// `expenses-panel.tsx` (mort depuis T-CN3.1, `MovementsList` a pris sa place
// sur la page d'accueil) : `createExpenseAction` puis, si une aide est
// cochée, composition de 1 ou 2 appels `addAidAction` (« les 2 » = split via
// `aid-split.ts`, même logique que `aid-section.tsx`, jamais recalculée ici —
// calc-engine reste seul habilité, DA4).
type Props = {
  currentMemberId: string;
  defaultShares: MemberShare[];
  templates: RecurringTemplate[];
  // "back" (interception) = retour exact à l'origine ; "home" (repli direct,
  // pas d'origine in-app) = accueil. `onClose` reste interne (useRouter) —
  // une fonction fermée sur le router n'est pas sérialisable depuis les
  // Server Components qui montent cet écran (@modal/(.)ajouter, /ajouter).
  closeTo: "back" | "home";
  initialMode: typeof ADD_MODE_ONCE | typeof ADD_MODE_RECURRENT;
};

export function AddScreen({ currentMemberId, defaultShares, templates, closeTo, initialMode }: Props) {
  const router = useRouter();
  const onClose = closeTo === "back" ? () => router.back() : () => router.push("/");
  const [mode, setMode] = useState(initialMode);
  const [isPending, startTransition] = useGlobalTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd(input: NewExpenseInput): Promise<boolean> {
    setError(null);

    return new Promise((resolve) => {
      startTransition(async () => {
        const result = await createExpenseAction({
          label: input.label,
          category: input.category,
          grossCents: input.grossCents,
          payerId: input.payerId,
          incurredOn: input.incurredOn,
          shares: input.shares,
        });

        if (!result.ok) {
          setError(result.error.message);
          resolve(false);
          return;
        }

        const created = result.data;
        if (input.aid) {
          const otherMemberId = defaultShares.find((m) => m.memberId !== currentMemberId)?.memberId;

          if (input.aid.beneficiaryId === BOTH_BENEFICIARIES && otherMemberId) {
            const [firstCents, secondCents] = splitBothCents(input.aid.amountCents);
            const firstResult = await addAidAction({
              expenseId: created.id,
              label: "aide",
              beneficiaryId: currentMemberId,
              amountCents: firstCents,
            });
            if (firstResult.ok) {
              await addAidAction({
                expenseId: created.id,
                label: "aide",
                beneficiaryId: otherMemberId,
                amountCents: secondCents,
              });
            }
          } else {
            await addAidAction({
              expenseId: created.id,
              label: "aide",
              beneficiaryId: input.aid.beneficiaryId,
              amountCents: input.aid.amountCents,
            });
          }
        }

        // Le formulaire vit maintenant sur une route à part (/ajouter) : plus
        // de state client partagé avec la liste (contrairement à l'ancien
        // expenses-panel.tsx, qui vivait sur la même page). `router.refresh()`
        // revalidate les Server Components de l'écran d'origine avant d'y
        // revenir, sinon le RSC payload caché resterait périmé.
        router.refresh();
        resolve(true);
        onClose();
      });
    });
  }

  return (
    <Dialog open fullscreen title="ajouter" onClose={onClose}>
      <Stack gap={3}>
        <Tabs
          items={[
            { value: ADD_MODE_ONCE, label: "une fois" },
            { value: ADD_MODE_RECURRENT, label: "récurrent" },
          ]}
          active={mode}
          onChange={(value) => setMode(value as typeof mode)}
        />
        {mode === ADD_MODE_ONCE ? (
          <ExpenseForm
            currentMemberId={currentMemberId}
            defaultShares={defaultShares}
            pending={isPending}
            error={error}
            onSubmit={handleAdd}
          />
        ) : (
          <RecurringMode currentMemberId={currentMemberId} defaultShares={defaultShares} templates={templates} />
        )}
      </Stack>
    </Dialog>
  );
}

type RecurringModeProps = {
  currentMemberId: string;
  defaultShares: MemberShare[];
  templates: RecurringTemplate[];
};

// Composition T-CN4.3 (remplace /recurrence, supprimée) : la liste passe
// devant dès qu'il existe des charges actives — plus de formulaire vierge à
// chaque ouverture (T-CR2 inchangé, `RecurringTemplateList` ne remonte que
// les templates `active=true`). Formulaire replié derrière un bouton, même
// pattern disclosure que `aid-section.tsx`/`TemplateRow` (« options ») ;
// s'il n'y a rien à lister, le formulaire s'affiche directement (pas de
// bouton à afficher pour révéler une liste vide). `showForm` n'est réévalué
// qu'au montage : après une création depuis une liste déjà non vide,
// `RecurringTemplateForm` reste ouvert (son propre `router.refresh()` suffit
// à faire réapparaître la nouvelle charge dans la liste juste en dessous).
function RecurringMode({ currentMemberId, defaultShares, templates }: RecurringModeProps) {
  const hasTemplates = templates.length > 0;
  const [showForm, setShowForm] = useState(!hasTemplates);

  return (
    <Stack gap={4}>
      {hasTemplates ? (
        <Button variant="ghost" onClick={() => setShowForm((prev) => !prev)}>
          nouvelle charge récurrente
        </Button>
      ) : null}
      {showForm ? (
        <RecurringTemplateForm currentMemberId={currentMemberId} defaultShares={defaultShares} />
      ) : null}
      {hasTemplates ? (
        <>
          <WaterSeparator />
          <RecurringTemplateList
            currentMemberId={currentMemberId}
            defaultShares={defaultShares}
            templates={templates}
          />
        </>
      ) : null}
    </Stack>
  );
}
