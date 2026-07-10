"use client";

import { useRouter } from "next/navigation";
import { Button } from "../../../_components/design-system/core";
import styles from "./modal.module.css";

// Interception de /ajouter (navigation-ia §1.3) : ouvre l'écran en overlay
// plein écran par-dessus l'onglet courant ; fermer (annuler) = router.back()
// revient exactement à l'écran d'origine. Contenu placeholder en CN1 — le
// shell réel du formulaire arrive en T-CN1.3.
export default function AjouterModal() {
  const router = useRouter();
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="ajouter">
      <header className={styles.header}>
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          annuler
        </Button>
        <span className={styles.title}>ajouter</span>
        <span className={styles.spacer} aria-hidden="true" />
      </header>
      <main className={styles.body}>
        <p style={{ color: "var(--text-secondary)" }}>bientôt disponible</p>
      </main>
    </div>
  );
}
