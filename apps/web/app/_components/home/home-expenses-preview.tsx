"use client";

// Aperçu accueil (T-CN2.2) + bascule vers l'état vide propre quand la
// dernière dépense du foyer disparaît côté client, jusqu'à 0 (édge case CF1,
// non couvert par le seul `visibleGroups` de `MovementsList` — cf. son
// commentaire d'en-tête). `showFirstExpenseInvite` sur page.tsx était décidé
// une fois, côté serveur, à partir du fetch initial : une suppression
// ultérieure (fetch ciblé T-CF1, jamais `router.refresh()`) ne le recalcule
// jamais, alors que `MovementsList` avait déjà cessé de "rester monté sur du
// vide". Ce wrapper client détient donc la décision à la place de page.tsx
// (Server Component, ne peut pas tenir de state).
//
// `MovementsList` reste TOUJOURS monté (jamais démonté selon `empty`) : il
// est le seul abonné au bus `notifyDataChanged(["expenses"])` (via
// `subscribeDataChanged`, cf. son commentaire). Le démonter en cas de foyer
// vide coupait cet abonnement — un ajout ultérieur depuis /ajouter (route
// interceptée, même instance de page, jamais de navigation complète) notifie
// le bus mais plus personne n'écoute : l'accueil restait bloqué sur
// `FirstExpenseInvite` jusqu'à un reload (revue Copilot, PR #17). `empty` est
// donc synchronisé sur `onEmptyChange`, rapporté par `MovementsList` après
// CHAQUE fetch ciblé résolu, dans les deux sens.
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

  return (
    <>
      <MovementsList
        expenses={initialExpenses}
        members={members}
        currentMemberId={currentMemberId}
        previewLimit={3}
        onEmptyChange={setEmpty}
      />
      {empty ? <FirstExpenseInvite /> : null}
    </>
  );
}
