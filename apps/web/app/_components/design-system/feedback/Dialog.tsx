"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "../core";
import styles from "./Dialog.module.css";

type Props = {
  open: boolean;
  onClose?: () => void;
  title?: string;
  // Mode plein écran (navigation-ia §3.3) : additif, défaut false → le
  // comportement centré + scrim existant reste strictement inchangé.
  fullscreen?: boolean;
  // Croix de fermeture en haut à droite du panneau (mode centré uniquement),
  // à la place du bouton « fermer » en pied de modale (pas les deux à la
  // fois) — additif, défaut false : les consommateurs existants (ex.
  // password-section, montée sans affordance de fermeture visible) ne sont
  // pas affectés.
  showCloseButton?: boolean;
  children: ReactNode;
};

const TITLE_ID = "dialog-title";

export function Dialog({
  open,
  onClose,
  title,
  fullscreen = false,
  showCloseButton = false,
  children,
}: Props) {
  useEffect(() => {
    if (!open || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  // Plein écran : occupe 100% du viewport, aucun scrim (plus de fond à
  // assombrir), header minimal annuler/titre. Pas de bouton de validation ici —
  // le formulaire garde son propre bouton de soumission (CN4).
  if (fullscreen) {
    return (
      <div
        className={styles.fullscreen}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? TITLE_ID : undefined}
      >
        <header className={styles.fullscreenHeader}>
          {onClose ? (
            <Button variant="ghost" size="sm" onClick={onClose}>
              annuler
            </Button>
          ) : (
            <span aria-hidden="true" />
          )}
          {title ? (
            <span id={TITLE_ID} className={styles.fullscreenTitle}>
              {title}
            </span>
          ) : null}
          <span aria-hidden="true" />
        </header>
        <div className={styles.fullscreenBody}>{children}</div>
      </div>
    );
  }

  return (
    <div className={styles.scrim} onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? TITLE_ID : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {showCloseButton && onClose ? (
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="fermer"
          >
            <X size={18} aria-hidden="true" />
          </button>
        ) : null}
        {title ? (
          <h2 id={TITLE_ID} className={styles.title}>
            {title}
          </h2>
        ) : null}
        <div className={styles.body}>{children}</div>
        {onClose && !showCloseButton ? (
          <div className={styles.close}>
            <Button variant="secondary" onClick={onClose}>
              fermer
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
