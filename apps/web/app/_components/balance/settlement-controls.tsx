"use client";

// Parcours de régularisation (spec 8.1/5.3, T-C6.6, D15 v0.5). Le débiteur
// déclenche (« Solder » pour tout, ou un montant partiel/supérieur via un flux
// replié), le créancier confirme (« J'ai reçu »). Vocabulaire strict : jamais
// « régularisation »/« settlement » à l'écran — seulement qui doit confirmer
// quoi à qui, en langage humain. Le montant confirmé peut être partiel : les
// bannières communiquent le montant échangé, jamais que le solde retombe à
// zéro (ce qui peut être faux si de nouvelles dépenses sont apparues entre-temps).
// Montant > solde courant (D15 v0.5) : plus de refus — le solde s'inverse à la
// confirmation. Pas de plafond artificiel côté formulaire (montant libre),
// mais un cran de confirmation explicite avant envoi pour éviter une faute de
// frappe (« ce remboursement inverse le solde »), ton neutre, jamais alarmant.
//
// Pas d'état local optimiste sur le settlement lui-même : après chaque action
// réussie, `onSettled` (fourni par `BalanceCard`, T-CF1) rejoue un fetch ciblé
// (solde + régularisation courante) et met à jour son propre state, pour
// éviter tout affichage incohérent (ex. solde encore non nul juste après
// confirmation) — sans jamais réinvalider toute la page (`router.refresh()`).

import type { ReactNode } from "react";
import { useState } from "react";
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
import { Notice, useGlobalTransition } from "../design-system/feedback";
import { Stack } from "../design-system/layout";

type Props = {
  currentMemberId: string;
  debtorId: string;
  debtorName: string;
  creditorName: string;
  settlement: Settlement | null;
  /** Désactive le déclenchement quand le solde courant est nul (spec 8.1). */
  amountCents: number;
  /** Fetch ciblé (solde + règlement courant) après une action réussie — T-CF1. */
  onSettled: () => void;
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
  onSettled,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useGlobalTransition();
  const [showPartialForm, setShowPartialForm] = useState(false);
  const [partialAmount, setPartialAmount] = useState("");
  // Montant en attente de confirmation explicite d'inversion (D15 v0.5) —
  // `null` tant que l'utilisateur n'a pas encore vu/validé l'avertissement.
  const [pendingInversionCents, setPendingInversionCents] = useState<number | null>(null);

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
      setPendingInversionCents(null);
      onSettled();
    });
  }

  function submitPartial() {
    const parsed = parseAmountToCents(partialAmount);
    if (parsed === null || parsed <= 0) {
      setError("montant invalide");
      setPendingInversionCents(null);
      return;
    }
    // Montant supérieur au solde courant (D15 v0.5, inversion) : un premier
    // clic affiche l'avertissement plutôt que d'envoyer directement — un
    // second clic sur le même montant confirme et envoie.
    if (parsed > amountCents && pendingInversionCents !== parsed) {
      setError(null);
      setPendingInversionCents(parsed);
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
        {pendingInversionCents !== null ? (
          <Notice tone="neutral">
            {creditorName} te devra désormais{" "}
            <AmountDisplay value={formatAmountEUR(pendingInversionCents - amountCents)} /> après ce
            remboursement.
          </Notice>
        ) : null}
        <Input
          label="montant remboursé"
          value={partialAmount}
          onChange={(e) => {
            setPartialAmount(e.target.value);
            setPendingInversionCents(null);
          }}
          placeholder="0,00"
          inputMode="decimal"
          suffix="€"
        />
        <Stack direction="row" gap={1}>
          <Button disabled={isPending} onClick={submitPartial}>
            {pendingInversionCents !== null ? "confirmer ce remboursement" : "envoyer ce remboursement"}
          </Button>
          <Button
            disabled={isPending}
            onClick={() => {
              setError(null);
              setShowPartialForm(false);
              setPartialAmount("");
              setPendingInversionCents(null);
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
