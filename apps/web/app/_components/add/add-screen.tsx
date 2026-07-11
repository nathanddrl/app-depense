"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createExpenseAction, addAidAction } from "../../actions";
import type { MemberShare } from "../../../lib/household";
import { ExpenseForm, type NewExpenseInput } from "../expenses/expense-form";
import { BOTH_BENEFICIARIES, splitBothCents } from "../expenses/aid-split";
import { Dialog } from "../design-system/feedback";

// Shell de l'écran « ajouter » (navigation-ia §1.3/§3.3), partagé par les deux
// points d'entrée : la route interceptée (@modal/(.)ajouter) et le repli plein
// écran (/ajouter). Mode « une fois » par défaut (T-CN4) — la bascule
// ponctuel/récurrent (Tabs) arrive en CN4.1, pas anticipée ici. onClose vient
// de l'appelant : back() pour l'interception (retour exact à l'origine),
// accueil pour le repli direct.
//
// Orchestration reprise telle quelle de l'ancien `expenses-panel.tsx` (mort
// depuis T-CN3.1, `MovementsList` a pris sa place sur la page d'accueil) :
// `createExpenseAction` puis, si une aide est cochée, composition de 1 ou 2
// appels `addAidAction` (« les 2 » = split via `aid-split.ts`, même logique
// que `aid-section.tsx`, jamais recalculée ici — calc-engine reste seul
// habilité, DA4).
type Props = {
  currentMemberId: string;
  defaultShares: MemberShare[];
  // "back" (interception) = retour exact à l'origine ; "home" (repli direct,
  // pas d'origine in-app) = accueil. `onClose` reste interne (useRouter) —
  // une fonction fermée sur le router n'est pas sérialisable depuis les
  // Server Components qui montent cet écran (@modal/(.)ajouter, /ajouter).
  closeTo: "back" | "home";
};

export function AddScreen({ currentMemberId, defaultShares, closeTo }: Props) {
  const router = useRouter();
  const onClose = closeTo === "back" ? () => router.back() : () => router.push("/");
  const [isPending, startTransition] = useTransition();
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
      <ExpenseForm
        currentMemberId={currentMemberId}
        defaultShares={defaultShares}
        pending={isPending}
        error={error}
        onSubmit={handleAdd}
      />
    </Dialog>
  );
}
