"use client";

// Orchestrateur de la section dépenses (spec ch.5.1, 8.4) : possède l'état
// (liste + optimistic update) et compose l'historique filtrable
// (`HistorySection`). Recomposé depuis la maquette (uiuix-guide/mainpage.zip,
// prototypes/main-page/) — logique de saisie inchangée.
//
// NOTE (T-CN4) : le formulaire de création (`ExpenseForm`) et son
// orchestration `createExpenseAction`/`addAidAction` ont été déplacés dans
// `_components/add/add-screen.tsx` (écran plein écran /ajouter). Ce composant
// n'a plus aucun importeur depuis T-CN3.1 (`page.tsx` utilise `MovementsList`)
// — probablement mort en totalité désormais, avec `HistorySection` qu'il
// composait. Laissé en l'état, à trancher dans une carte de nettoyage dédiée.
//
// Optimistic UI : la dépense apparaît immédiatement, rollback silencieux si le
// serveur refuse. On n'affiche PAS de parts calculées côté client pour l'entrée
// optimiste — calc-engine reste la seule source de calcul, même à l'affichage ;
// les parts n'apparaissent qu'au retour serveur.

import { useState } from "react";
import type { Expense } from "@app/domain-expense";
import type { MemberShare } from "../../../lib/household";
import { HistorySection } from "./history-section";
import { Stack } from "../design-system/layout";

type Props = {
  currentMemberId: string;
  initialExpenses: Expense[];
  defaultShares: MemberShare[];
};

export function ExpensesPanel({ currentMemberId, initialExpenses, defaultShares }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);

  function handleSharesUpdated(expenseId: string, shares: Expense["shares"]) {
    setExpenses((prev) => prev.map((e) => (e.id === expenseId ? { ...e, shares } : e)));
  }

  return (
    <Stack gap={3}>
      <HistorySection
        expenses={expenses}
        currentMemberId={currentMemberId}
        defaultShares={defaultShares}
        onSharesUpdated={handleSharesUpdated}
      />
    </Stack>
  );
}
