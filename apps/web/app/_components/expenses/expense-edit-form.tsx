"use client";

// Formulaire d'édition d'une dépense (spec ch.5.1) — ouvert par un clic/tap
// direct sur la ligne dans `movements-list.tsx` (plus d'étape intermédiaire de
// menu). Champs : libellé, montant, catégorie, partage. Le payeur et la date
// ne sont pas éditables ici (correction rapide, pas ressaisie complète) — le
// patch n'envoie que les champs modifiés, tout champ absent restant inchangé
// côté domaine (`updateExpense`).
//
// Même pattern contrôlé que `EditRow` (admin-expense-table.tsx) : `Input` exige
// `value`, donc état local par champ ; l'action est appelée via `useTransition`,
// l'erreur serveur (dont EXPENSE_LOCKED) est affichée telle quelle.
//
// Partage : même curseur couplé qu'`expense-form.tsx` (un seul state
// `payerPct`, l'autre part = `100 - payerPct`), mais visible directement
// (pas de disclosure « Options » ici — la simplicité de saisie ne concerne
// que la création, à l'édition le champ doit être visible). Modifier le
// partage recompute les parts figées côté serveur (`updateExpense` :
// `patch.shares` fourni → nouveau snapshot), donc n'affecte jamais une
// dépense déjà réglée (verrou EXPENSE_LOCKED en amont, déjà garanti par
// `isPressable` dans `movements-list.tsx` qui empêche même d'atteindre ce
// formulaire pour une dépense verrouillée).
//
// Suppression : ex-`ExpenseActionSheet` (menu séparé, retiré — devenu
// redondant). Le bouton « supprimer » ici délègue tout le flux (toast
// d'annulation 3 s) au parent via `onDelete`, sans confirmation locale.

import { useState } from "react";
import type { Category, Expense } from "@app/domain-expense";
import type { MemberShare } from "../../../lib/household";
import { parseAmountToCents } from "../../../lib/amount";
import { updateExpenseAction } from "../../actions";
import { CategorySelect } from "./category-select";
import { Button, Input } from "../design-system/core";
import { Dialog, Notice, useGlobalTransition } from "../design-system/feedback";
import { Stack } from "../design-system/layout";
import styles from "./expense-edit-form.module.css";

type Props = {
  expense: Expense;
  members: MemberShare[];
  currentMemberId: string;
  onClose: () => void;
  onSaved: () => void;
  onDelete: () => void;
};

export function ExpenseEditForm({
  expense,
  members,
  currentMemberId,
  onClose,
  onSaved,
  onDelete,
}: Props) {
  const otherMember = members.find((m) => m.memberId !== currentMemberId);
  const initialPayerPct =
    expense.shares.find((s) => s.memberId === currentMemberId)?.pctSnapshot ?? 50;

  const [label, setLabel] = useState(expense.label);
  const [category, setCategory] = useState<Category>(expense.category);
  const [amount, setAmount] = useState((expense.grossCents / 100).toFixed(2));
  const [payerPct, setPayerPct] = useState(initialPayerPct);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useGlobalTransition();

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

    const shares = members.map((m) => ({
      memberId: m.memberId,
      pct: m.memberId === currentMemberId ? payerPct : 100 - payerPct,
    }));

    startTransition(async () => {
      const result = await updateExpenseAction({
        expenseId: expense.id,
        patch: { label: trimmedLabel, category, grossCents, shares },
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
          {otherMember ? (
            <Stack gap={1}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                partage
              </span>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={payerPct}
                  onChange={(e) => setPayerPct(Number(e.target.value))}
                  style={{ flex: "1 1 auto", minWidth: 0, accentColor: "var(--text-primary)" }}
                />
                <span
                  className="tabular-nums"
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--text-primary)",
                    marginLeft: "auto",
                  }}
                >
                  toi {payerPct}% · {otherMember.displayName} {100 - payerPct}%
                </span>
              </div>
            </Stack>
          ) : null}
          {formError ? <Notice tone="error">{formError}</Notice> : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? "enregistrement…" : "enregistrer"}
          </Button>
          <div className={styles.deleteAction}>
            <Button variant="secondary" onClick={onDelete}>
              supprimer
            </Button>
          </div>
        </Stack>
      </form>
    </Dialog>
  );
}
