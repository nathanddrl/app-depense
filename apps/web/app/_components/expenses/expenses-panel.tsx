"use client";

// Orchestrateur de la section dépenses (spec ch.5.1, 8.4) : possède l'état
// (liste + optimistic update), compose le formulaire de création
// (`ExpenseForm`) et l'historique filtrable (`HistorySection`). Recomposé
// depuis la maquette (uiuix-guide/mainpage.zip, prototypes/main-page/) — un
// seul séparateur entre formulaire et historique, logique de saisie inchangée.
//
// Optimistic UI : la dépense apparaît immédiatement, rollback silencieux si le
// serveur refuse. On n'affiche PAS de parts calculées côté client pour l'entrée
// optimiste — calc-engine reste la seule source de calcul, même à l'affichage ;
// les parts n'apparaissent qu'au retour serveur.

import { useOptimistic, useState, useTransition } from "react";
import { createExpenseAction, addAidAction } from "../../actions";
import type { Expense } from "@app/domain-expense";
import type { MemberShare } from "../../../lib/household";
import { ExpenseForm, type NewExpenseInput } from "./expense-form";
import { HistorySection, type HistoryExpense } from "./history-section";
import { WaterSeparator } from "../design-system/navigation";
import { Stack } from "../design-system/layout";

type Props = {
  currentMemberId: string;
  initialExpenses: Expense[];
  defaultShares: MemberShare[];
};

export function ExpensesPanel({ currentMemberId, initialExpenses, defaultShares }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [optimisticExpenses, addOptimistic] = useOptimistic<HistoryExpense[], HistoryExpense>(
    expenses,
    (state, next) => [next, ...state],
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd(input: NewExpenseInput): Promise<boolean> {
    setError(null);
    const tempId = `temp-${crypto.randomUUID()}`;

    return new Promise((resolve) => {
      startTransition(async () => {
        addOptimistic({
          id: tempId,
          label: input.label,
          category: input.category,
          grossCents: input.grossCents,
          incurredOn: input.incurredOn,
          pending: true,
        });

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

        // Composition côté client de deux actions déjà existantes (aucune
        // logique métier ajoutée) : l'aide n'existe qu'une fois la dépense
        // créée (elle porte un `expenseId`), donc ce second appel ne peut pas
        // être fusionné dans `createExpenseAction`.
        let created = result.data;
        if (input.aid) {
          const aidResult = await addAidAction({
            expenseId: created.id,
            label: "aide",
            beneficiaryId: currentMemberId,
            amountCents: input.aid.amountCents,
          });
          if (aidResult.ok) {
            created = { ...created, aids: aidResult.data.aids, shares: aidResult.data.shares };
          }
        }

        setExpenses((prev) => [created, ...prev]);
        resolve(true);
      });
    });
  }

  function handleSharesUpdated(expenseId: string, shares: Expense["shares"]) {
    setExpenses((prev) => prev.map((e) => (e.id === expenseId ? { ...e, shares } : e)));
  }

  return (
    <Stack gap={3}>
      <ExpenseForm
        currentMemberId={currentMemberId}
        defaultShares={defaultShares}
        pending={isPending}
        error={error}
        onSubmit={handleAdd}
      />
      <WaterSeparator />
      <HistorySection
        expenses={optimisticExpenses}
        currentMemberId={currentMemberId}
        defaultShares={defaultShares}
        onSharesUpdated={handleSharesUpdated}
      />
    </Stack>
  );
}
