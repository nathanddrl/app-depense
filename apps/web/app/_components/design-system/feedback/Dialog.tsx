"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "../core";
import styles from "./Dialog.module.css";

type Props = {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: ReactNode;
};

const TITLE_ID = "dialog-title";

export function Dialog({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.scrim} onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? TITLE_ID : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <h2 id={TITLE_ID} className={styles.title}>
            {title}
          </h2>
        ) : null}
        {children}
        {onClose ? (
          <div className={styles.close}>
            <Button variant="ghost" size="sm" onClick={onClose}>
              fermer
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
