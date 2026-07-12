"use client";

// Toast d'annulation (undo) — surface d'attention temporaire, ton neutre par
// construction (comme Notice, aucun ton célébratoire). Utilisé pour la
// suppression différée d'une dépense (T-CN) : l'action réelle n'est déclenchée
// (`onDismiss`) qu'à l'échéance du minuteur ; `onUndo` l'annule avant.
//
// Le minuteur vit ICI : un seul endroit possède le compte à rebours, ce qui
// évite de dupliquer un setTimeout côté appelant. Le composant ne connaît pas la
// nature de l'action — il expose seulement « le temps est écoulé » / « annulé ».

import { useEffect, useRef } from "react";
import { Button } from "../core";
import styles from "./UndoToast.module.css";

type Props = {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
};

export function UndoToast({ message, onUndo, onDismiss, durationMs = 3000 }: Props) {
  // Ref sur le callback : le minuteur ne doit être armé qu'une fois (au montage),
  // sans se réarmer si le parent recrée `onDismiss` à chaque rendu.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const id = setTimeout(() => onDismissRef.current(), durationMs);
    return () => clearTimeout(id);
  }, [durationMs]);

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <span className={styles.message}>{message}</span>
      <Button variant="ghost" size="sm" onClick={onUndo}>
        annuler
      </Button>
      <span
        className={styles.progress}
        style={{ animationDuration: `${durationMs}ms` }}
        aria-hidden="true"
      />
    </div>
  );
}
