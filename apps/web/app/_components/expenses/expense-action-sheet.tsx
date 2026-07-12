"use client";

// Overlay de mise en avant (appui long) — la dépense visée est reprise au centre
// de l'écran, le reste sombre et flou derrière, avec deux actions : éditer /
// supprimer. Ce composant ne détecte PAS le geste (c'est `movements-list.tsx`
// qui arme le minuteur d'appui long sur chaque ligne) : il se contente de rendre
// l'overlay quand une dépense est active.
//
// La ligne est RECOMPOSÉE ici (chip + libellé + montant), pas déplacée : dans la
// liste, chaque ligne est un Fragment d'une grille partagée, non un conteneur
// isolé — on ne peut pas la translater en place, on la ré-affiche dans l'overlay.

import { useEffect } from "react";
import type { Expense } from "@app/domain-expense";
import { formatAmountEUR } from "@app/shared";
import { memberDisplayName, type MemberShare } from "../../../lib/household";
import { categoryLabelOf } from "./categories";
import { CategoryChip, AmountDisplay } from "../design-system/balance";
import { Button } from "../design-system/core";
import styles from "./expense-action-sheet.module.css";

type Props = {
  expense: Expense;
  members: MemberShare[];
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
};

export function ExpenseActionSheet({ expense, members, onEdit, onDelete, onClose }: Props) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.scrim} onClick={onClose} role="presentation">
      <div
        className={styles.stage}
        role="dialog"
        aria-modal="true"
        aria-label="actions sur la dépense"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.card}>
          {expense.label ? <span className={styles.label}>{expense.label}</span> : null}
          <div className={styles.row}>
            <div className={styles.category}>
              <CategoryChip name={categoryLabelOf(expense.category)} size={28} />
              <span>{categoryLabelOf(expense.category).toLowerCase()}</span>
            </div>
            <span className={styles.payer}>{memberDisplayName(members, expense.payerId)}</span>
            <span className={styles.amount}>
              <AmountDisplay value={formatAmountEUR(expense.grossCents)} size="sm" />
            </span>
          </div>
        </div>

        <div className={styles.actions}>
          <Button variant="primary" onClick={onEdit}>
            éditer
          </Button>
          <div className={styles.deleteAction}>
            <Button variant="secondary" onClick={onDelete}>
              supprimer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
