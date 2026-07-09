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

import type { ReactNode } from "react";
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
import { Button } from "../design-system/core";
import { AmountDisplay } from "../design-system/balance";
import { Notice } from "../design-system/feedback";

type Props = {
  currentMemberId: string;
  debtorId: string;
  debtorName: string;
  creditorName: string;
  settlement: Settlement | null;
  /** Désactive le déclenchement quand le solde courant est nul (spec 8.1). */
  amountCents: number;
};

/** Perspective du lecteur : jamais de « débiteur »/« créancier », que du « tu ».
 * Montant en `AmountDisplay` (T-CD2.3) — le reste de la phrase est inchangé mot pour mot. */
function bannerMessage(
  isInitiator: boolean,
  isCreditor: boolean,
  debtorName: string,
  creditorName: string,
  amount: string,
): ReactNode {
  if (isInitiator) {
    return (
      <>
        Tu as dit avoir remboursé <AmountDisplay value={amount} /> à {creditorName}. En attente de
        sa confirmation.
      </>
    );
  }
  if (isCreditor) {
    return (
      <>
        {debtorName} dit t&apos;avoir remboursé <AmountDisplay value={amount} />.
      </>
    );
  }
  return (
    <>
      {creditorName} doit confirmer avoir reçu <AmountDisplay value={amount} /> de {debtorName}.
    </>
  );
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

  // Colonne flex : stretch (comportement par défaut de l'axe transverse en
  // flex-column) donne au Button sa largeur 100 % sans toucher à son CSS —
  // Button n'a pas de `width` propre, ce qui est le bon défaut pour ses
  // autres usages (T-CD2.3 : vérifié, pas de hack nécessaire).
  const layoutStyle = {
    marginTop: "var(--space-2)",
    display: "flex",
    flexDirection: "column" as const,
    gap: "var(--space-1)",
  };

  if (settlement && settlement.status === "pending") {
    const isInitiator = currentMemberId === settlement.initiatedBy;
    const isCreditor = currentMemberId === settlement.toMemberId;
    const amount = formatAmountEUR(settlement.amountCents);

    return (
      <div style={layoutStyle}>
        <Notice tone="neutral">
          {bannerMessage(isInitiator, isCreditor, debtorName, creditorName, amount)}
        </Notice>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {isInitiator ? (
          <Button
            disabled={isPending}
            onClick={() => run(() => cancelSettlementAction({ settlementId: settlement.id }))}
          >
            Annuler
          </Button>
        ) : null}
        {isCreditor ? (
          <Button
            disabled={isPending}
            onClick={() => run(() => confirmSettlementAction({ settlementId: settlement.id }))}
          >
            J&apos;ai reçu
          </Button>
        ) : null}
      </div>
    );
  }

  // Seul le débiteur peut déclencher (D16), et seulement si le solde n'est pas
  // déjà nul (désactivée si solde nul, spec 8.1).
  if (currentMemberId !== debtorId || amountCents === 0) return null;

  return (
    <div style={layoutStyle}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button disabled={isPending} onClick={() => run(() => initiateSettlementAction())}>
        Solder
      </Button>
    </div>
  );
}
