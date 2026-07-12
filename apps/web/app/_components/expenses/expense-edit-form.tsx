"use client";

// Formulaire d'édition d'une dépense (spec ch.5.1) — porté par le geste d'appui
// long dans `movements-list.tsx`. Périmètre volontairement réduit aux 3 champs
// demandés : nom, catégorie, montant. Le payeur, la date et la répartition ne
// sont pas éditables ici (correction rapide, pas ressaisie complète) — le patch
// n'envoie que les champs modifiés, tout champ absent restant inchangé côté
// domaine (`updateExpense`).
//
// Même pattern contrôlé que `EditRow` (admin-expense-table.tsx) : `Input` exige
// `value`, donc état local par champ ; l'action est appelée via `useTransition`,
// l'erreur serveur (dont EXPENSE_LOCKED) est affichée telle quelle.

import { useState, useTransition } from "react";
import type { Category, Expense } from "@app/domain-expense";
import { parseAmountToCents } from "../../../lib/amount";
import { updateExpenseAction } from "../../actions";
import { CategorySelect } from "./category-select";
import { Button, Input } from "../design-system/core";
import { Dialog, Notice } from "../design-system/feedback";
import { Stack } from "../design-system/layout";

type Props = {
  expense: Expense;
  onClose: () => void;
  onSaved: () => void;
};

export function ExpenseEditForm({ expense, onClose, onSaved }: Props) {
  const [label, setLabel] = useState(expense.label);
  const [category, setCategory] = useState<Category>(expense.category);
  const [amount, setAmount] = useState((expense.grossCents / 100).toFixed(2));
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setFormError(null);
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setFormError("libellé requis");
      return;
    }
    const grossCents = parseAmountToCents(amount);
    if (grossCents === null) {
      setFormError("montant invalide");
      return;
    }

    startTransition(async () => {
      const result = await updateExpenseAction({
        expenseId: expense.id,
        patch: { label: trimmedLabel, category, grossCents },
      });
      if (result.ok) {
        onSaved();
      } else {
        setFormError(result.error.message);
      }
    });
  }

  return (
    <Dialog open title="modifier la dépense" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <Stack gap={3}>
          <Input label="libellé" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Input
            label="montant"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
            suffix="€"
          />
          <CategorySelect value={category} onChange={setCategory} />
          {formError ? <Notice tone="error">{formError}</Notice> : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? "enregistrement…" : "enregistrer"}
          </Button>
        </Stack>
      </form>
    </Dialog>
  );
}
