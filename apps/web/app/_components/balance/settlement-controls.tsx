"use client";

// Parcours de régularisation (spec 8.1/5.3, T-C6.6) : le débiteur déclenche
// (« Solder »), le créancier confirme (« J'ai reçu »). Vocabulaire strict :
// jamais « régularisation »/« settlement » à l'écran — seulement qui doit
// confirmer quoi à qui, en langage humain.
//
// Pas d'état local optimiste sur le settlement lui-même : après chaque action
// réussie, `router.refresh()` refait tourner `BalancePanel` (RSC) avec des
// données fraîches (solde + régularisation courante), pour éviter tout
// affichage incohérent (ex. solde encore non nul juste après confirmation).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  initiateSettlementAction,
  confirmSettlementAction,
  cancelSettlementAction,
} from "../../actions";
import { formatAmountEUR } from "@app/shared";
import type { ActionResult } from "@app/shared";
import type { Settlement } from "@app/domain-settlement";
import styles from "./settlement-controls.module.css";

type Props = {
  currentMemberId: string;
  debtorId: string;
  debtorName: string;
  creditorName: string;
  settlement: Settlement | null;
  /** Désactive le déclenchement quand le solde courant est nul (spec 8.1). */
  amountCents: number;
};

/** Perspective du lecteur : jamais de « débiteur »/« créancier », que du « tu ». */
function bannerMessage(
  isInitiator: boolean,
  isCreditor: boolean,
  debtorName: string,
  creditorName: string,
  amount: string,
): string {
  if (isInitiator) {
    return `Tu as dit avoir remboursé ${amount} à ${creditorName}. En attente de sa confirmation.`;
  }
  if (isCreditor) {
    return `${debtorName} dit t'avoir remboursé ${amount}.`;
  }
  return `${creditorName} doit confirmer avoir reçu ${amount} de ${debtorName}.`;
}

export function SettlementControls({
  currentMemberId,
  debtorId,
  debtorName,
  creditorName,
  settlement,
  amountCents,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: () => Promise<ActionResult<Settlement>>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      router.refresh();
    });
  }

  if (settlement && settlement.status === "pending") {
    const isInitiator = currentMemberId === settlement.initiatedBy;
    const isCreditor = currentMemberId === settlement.toMemberId;
    const amount = formatAmountEUR(settlement.amountCents);

    return (
      <div className={styles.banner}>
        <p className={styles.line}>
          {bannerMessage(isInitiator, isCreditor, debtorName, creditorName, amount)}
        </p>
        {error ? <p role="alert">{error}</p> : null}
        {isInitiator ? (
          <button
            type="button"
            className={styles.button}
            disabled={isPending}
            onClick={() => run(() => cancelSettlementAction({ settlementId: settlement.id }))}
          >
            Annuler
          </button>
        ) : null}
        {isCreditor ? (
          <button
            type="button"
            className={styles.button}
            disabled={isPending}
            onClick={() => run(() => confirmSettlementAction({ settlementId: settlement.id }))}
          >
            J&apos;ai reçu
          </button>
        ) : null}
      </div>
    );
  }

  // Seul le débiteur peut déclencher (D16), et seulement si le solde n'est pas
  // déjà nul (désactivée si solde nul, spec 8.1).
  if (currentMemberId !== debtorId || amountCents === 0) return null;

  return (
    <div className={styles.trigger}>
      {error ? <p role="alert">{error}</p> : null}
      <button
        type="button"
        className={styles.button}
        disabled={isPending}
        onClick={() => run(() => initiateSettlementAction())}
      >
        Solder
      </button>
    </div>
  );
}
