"use client";

// Section « export » des réglages (T-EXPORT1). Comme « changer le mot de passe »
// (password-section.tsx), la ligne de réglages n'ouvre qu'une porte d'entrée :
// le contenu (cases à mois + bouton) vit derrière une Dialog plein écran, jamais
// déplié d'emblée dans la liste.
//
// Le membre coche un ou plusieurs mois (uniquement ceux ayant réellement des
// dépenses, fournis par le serveur via `listExpenseMonths`) puis télécharge le
// classeur Excel du foyer. Le téléchargement passe par une navigation vers la
// Route Handler GET : le header `Content-Disposition: attachment` déclenche le
// téléchargement sans quitter la page. Bouton désactivé tant qu'aucun mois n'est
// coché → aucun appel réseau (DoD).

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button, Checkbox } from "../../_components/design-system/core";
import { Dialog } from "../../_components/design-system/feedback";
import { Stack } from "../../_components/design-system/layout";
import { monthLabel } from "../../_components/expenses/date-label";
import styles from "./reglages.module.css";

type Props = { months: string[] };

export function ExportSection({ months }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(month: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(month);
      else next.delete(month);
      return next;
    });
  }

  function handleExport() {
    const mois = [...selected].sort().join(",");
    window.location.href = `/api/export?mois=${encodeURIComponent(mois)}`;
  }

  return (
    <>
      <button
        type="button"
        className={styles.rowButton}
        onClick={() => setOpen(true)}
        disabled={months.length === 0}
      >
        <span>exporter les dépenses</span>
        <ChevronRight size={18} className={styles.chevron} aria-hidden="true" />
      </button>

      <Dialog open={open} fullscreen title="exporter les dépenses" onClose={() => setOpen(false)}>
        <Stack gap={3}>
          {months.length === 0 ? (
            <p className={styles.value}>aucune dépense à exporter</p>
          ) : (
            <>
              <div className={styles.exportMonths}>
                {months.map((month) => (
                  <Checkbox
                    key={month}
                    checked={selected.has(month)}
                    onChange={(checked) => toggle(month, checked)}
                    label={monthLabel(month)}
                  />
                ))}
              </div>
              <Button onClick={handleExport} disabled={selected.size === 0}>
                Exporter
              </Button>
            </>
          )}
        </Stack>
      </Dialog>
    </>
  );
}
