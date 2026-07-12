"use client";

// Parcours de régularisation (spec 8.1/5.3, T-C6.6, D15 révisé). Le débiteur
// déclenche (« Solder » pour tout, ou un montant partiel via un flux replié),
// le créancier confirme (« J'ai reçu »). Vocabulaire strict : jamais
// « régularisation »/« settlement » à l'écran — seulement qui doit confirmer
// quoi à qui, en langage humain. Le montant confirmé peut être partiel : les
// bannières communiquent le montant échangé, jamais que le solde retombe à
// zéro (ce qui peut être faux si de nouvelles dépenses sont apparues entre-temps).
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
import { parseAmountToCents } from "../../../lib/amount";
import { formatAmountEUR } from "@app/shared";
import type { ActionResult } from "@app/shared";
import type { Settlement } from "@app/domain-settlement";
import { Button, Input } from "../design-system/core";
import { AmountDisplay } from "../design-system/balance";
import { Notice } from "../design-system/feedback";
import { Stack } from "../design-system/layout";

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
        tu as dit avoir remboursé <AmountDisplay value={amount} /> à {creditorName} — en attente de
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
  const [showPartialForm, setShowPartialForm] = useState(false);
  const [partialAmount, setPartialAmount] = useState("");
  const router = useRouter();

  function run(action: () => Promise<ActionResult<Settlement>>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setShowPartialForm(false);
      setPartialAmount("");
      router.refresh();
    });
  }

  function submitPartial() {
    const parsed = parseAmountToCents(partialAmount);
    if (parsed === null || parsed <= 0) {
      setError("montant invalide");
      return;
    }
    if (parsed > amountCents) {
      setError("tu ne peux pas rembourser plus que ce que tu dois actuellement");
      return;
    }
    run(() => initiateSettlementAction({ amountCents: parsed }));
  }

  // Stack column : stretch (comportement par défaut de l'axe transverse en
  // flex-column) donne au Button sa largeur 100 % sans toucher à son CSS —
  // Button n'a pas de `width` propre, ce qui est le bon défaut pour ses
  // autres usages (T-CD2.3 : vérifié, pas de hack nécessaire). L'espacement
  // avec le contenu au-dessus (BalanceStatement/WaterLine) vient du `Stack`
  // parent dans balance-panel.tsx, pas d'ici (T-CD3).

  if (settlement && settlement.status === "pending") {
    const isInitiator = currentMemberId === settlement.initiatedBy;
    const isCreditor = currentMemberId === settlement.toMemberId;
    const amount = formatAmountEUR(settlement.amountCents);

    return (
      <Stack gap={1}>
        <Notice tone="neutral">
          {bannerMessage(isInitiator, isCreditor, debtorName, creditorName, amount)}
        </Notice>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {isInitiator ? (
          <Button
            disabled={isPending}
            onClick={() => run(() => cancelSettlementAction({ settlementId: settlement.id }))}
          >
            annuler
          </Button>
        ) : null}
        {isCreditor ? (
          <Button
            disabled={isPending}
            onClick={() => run(() => confirmSettlementAction({ settlementId: settlement.id }))}
          >
            j&apos;ai reçu
          </Button>
        ) : null}
      </Stack>
    );
  }

  // Seul le débiteur peut déclencher (D16), et seulement si le solde n'est pas
  // déjà nul (désactivée si solde nul, spec 8.1).
  if (currentMemberId !== debtorId || amountCents === 0) return null;

  if (showPartialForm) {
    return (
      <Stack gap={1}>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Input
          label="montant remboursé"
          value={partialAmount}
          onChange={(e) => setPartialAmount(e.target.value)}
          placeholder="0,00"
          inputMode="decimal"
          suffix="€"
        />
        <Stack direction="row" gap={1}>
          <Button disabled={isPending} onClick={submitPartial}>
            envoyer ce remboursement
          </Button>
          <Button
            disabled={isPending}
            onClick={() => {
              setError(null);
              setShowPartialForm(false);
              setPartialAmount("");
            }}
          >
            annuler
          </Button>
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack gap={1}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button
        disabled={isPending}
        onClick={() => run(() => initiateSettlementAction({ amountCents }))}
      >
        solder
      </Button>
      <Button
        disabled={isPending}
        onClick={() => {
          setError(null);
          setShowPartialForm(true);
        }}
      >
        rembourser un autre montant
      </Button>
    </Stack>
  );
}
