"use client";

// Toast de confirmation + question (ton neutre par construction, comme
// Notice/UndoToast — aucune variante « célébratoire »). Contrairement à
// UndoToast, pas de minuteur : la réponse à `question` est requise, rien ne
// se déclenche tout seul.

import type { ReactNode } from "react";
import { Button } from "../core";
import styles from "./ConfirmToast.module.css";

type Props = {
  message: ReactNode;
  question: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
  error?: string | null;
};

export function ConfirmToast({
  message,
  question,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  pending = false,
  error = null,
}: Props) {
  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <span className={styles.message}>{message}</span>
      <span className={styles.question}>{question}</span>
      {error ? <span className={styles.error}>{error}</span> : null}
      <div className={styles.actions}>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          {cancelLabel}
        </Button>
        <Button variant="secondary" size="sm" onClick={onConfirm} disabled={pending}>
          {pending ? "…" : confirmLabel}
        </Button>
      </div>
    </div>
  );
}
