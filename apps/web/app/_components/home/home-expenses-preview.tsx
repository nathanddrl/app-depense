"use client";

// Aperçu accueil (T-CN2.2) + bascule vers l'état vide propre quand la
// dernière dépense du foyer disparaît côté client, jusqu'à 0 (édge case CF1,
// non couvert par le seul `visibleGroups` de `MovementsList` — cf. son
// commentaire d'en-tête). `showFirstExpenseInvite` sur page.tsx était décidé
// une fois, côté serveur, à partir du fetch initial : une suppression
// ultérieure (fetch ciblé T-CF1, jamais `router.refresh()`) ne le recalcule
// jamais, alors que `MovementsList` avait déjà cessé de "rester monté sur du
// vide". Ce wrapper client détient donc la décision à la place de page.tsx
// (Server Component, ne peut pas tenir de state) et l'actualise via
// `onEmptied`, déclenché par `MovementsList` seulement après confirmation
// serveur d'un foyer réellement vide (jamais pendant l'animation de sortie ni
// la fenêtre d'annulation du toast).

import { useState } from "react";
import type { Expense } from "@app/domain-expense";
import type { MemberShare } from "../../../lib/household";
import { MovementsList } from "../expenses/movements-list";
import { FirstExpenseInvite } from "./first-expense-invite";

type Props = {
  initialExpenses: Expense[];
  members: MemberShare[];
  currentMemberId: string;
};

export function HomeExpensesPreview({ initialExpenses, members, currentMemberId }: Props) {
  const [empty, setEmpty] = useState(initialExpenses.length === 0);

  if (empty) return <FirstExpenseInvite />;

  return (
    <MovementsList
      expenses={initialExpenses}
      members={members}
      currentMemberId={currentMemberId}
      previewLimit={3}
      onEmptied={() => setEmpty(true)}
    />
  );
}
