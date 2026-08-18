"use client";

// Parcours de régularisation (spec 8.1/5.3, T-C6.6, D15 v0.5, T-CM1). Le
// débiteur déclenche un unique bouton « Solder » qui ouvre une Dialog de
// confirmation (montant total pré-rempli, bascule optionnelle vers un
// montant personnalisé dans la même modale), le créancier confirme
// (« J'ai reçu »). Vocabulaire strict : jamais « régularisation »/« settlement »
// ni le vocabulaire produit proscrit (T-CM1) à l'écran — seulement qui doit
// confirmer quoi à qui, en langage humain, en tutoyant. Le montant confirmé
// peut être partiel : les bannières communiquent le montant échangé, jamais que le
// solde retombe à zéro (ce qui peut être faux si de nouvelles dépenses sont
// apparues entre-temps). Montant > solde courant (D15 v0.5) : plus de refus —
// le solde s'inverse à la confirmation. Pas de plafond artificiel côté
// formulaire (montant libre), mais un cran de confirmation explicite avant
// envoi pour éviter une faute de frappe (« ça inverse le solde »), ton
// neutre, jamais alarmant.
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
import { Dialog, Notice, useGlobalTransition } from "../design-system/feedback";
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
        tu as dit avoir réglé <AmountDisplay value={amount} /> à {creditorName} — en attente de sa
        confirmation.
      </>
    );
  }
  if (isCreditor) {
    return (
      <>
        {debtorName} dit t&apos;avoir réglé <AmountDisplay value={amount} />.
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
  // Modale unique de déclenchement (T-CM1) : `dialogOpen` pilote son
  // affichage, `showPartialForm` bascule son CONTENU entre la question par
  // défaut (montant total) et le champ de saisie personnalisé — jamais une
  // seconde Dialog.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showPartialForm, setShowPartialForm] = useState(false);
  const [partialAmount, setPartialAmount] = useState("");
  // Montant en attente de confirmation explicite d'inversion (D15 v0.5) —
  // `null` tant que l'utilisateur n'a pas encore vu/validé l'avertissement.
  const [pendingInversionCents, setPendingInversionCents] = useState<number | null>(null);

  function resetDialog() {
    setDialogOpen(false);
    setShowPartialForm(false);
    setPartialAmount("");
    setPendingInversionCents(null);
    setError(null);
  }

  function run(action: () => Promise<ActionResult<Settlement>>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setDialogOpen(false);
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

  const totalAmount = formatAmountEUR(amountCents);

  return (
    <>
      <Stack gap={1}>
        {error && !dialogOpen ? <Notice tone="error">{error}</Notice> : null}
        <Button
          disabled={isPending}
          onClick={() => {
            setError(null);
            setDialogOpen(true);
          }}
        >
          solder
        </Button>
      </Stack>

      <Dialog open={dialogOpen} onClose={resetDialog} showCloseButton>
        {showPartialForm ? (
          <Stack gap={1}>
            {error ? <Notice tone="error">{error}</Notice> : null}
            {pendingInversionCents !== null ? (
              <Notice tone="neutral">
                {creditorName} te devra désormais{" "}
                <AmountDisplay value={formatAmountEUR(pendingInversionCents - amountCents)} /> après
                cette confirmation.
              </Notice>
            ) : null}
            <Input
              label="montant"
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
                {pendingInversionCents !== null ? "confirmer" : "envoyer"}
              </Button>
              <Button
                variant="secondary"
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
        ) : (
          <Stack gap={1}>
            {error ? <Notice tone="error">{error}</Notice> : null}
            <Notice tone="neutral">
              tu as réglé les <AmountDisplay value={totalAmount} /> que tu dois à {creditorName} ?
            </Notice>
            <Stack direction="row" gap={1}>
              <Button
                disabled={isPending}
                onClick={() => run(() => initiateSettlementAction({ amountCents }))}
              >
                confirmer
              </Button>
              <Button
                variant="secondary"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  setShowPartialForm(true);
                }}
              >
                autre montant
              </Button>
            </Stack>
          </Stack>
        )}
      </Dialog>
    </>
  );
}
