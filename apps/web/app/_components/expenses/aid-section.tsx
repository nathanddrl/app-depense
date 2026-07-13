"use client";

// Rattachement/retrait d'une aide sur une dépense (spec 5.2/8.2, T-C5.3). Première
// UI branchée sur `addAid`/`removeAid` de `@app/domain-aid` (T-C5.1 l'avait
// volontairement laissé hors scope).
//
// Vocabulaire strict (spec 8.2) : au moment de rattacher une aide, une phrase
// concrète explique son effet — jamais "charge nette", jamais de formule. Le
// "reste à partager" vient directement de `shares` renvoyées par le serveur
// (calc-engine reste la seule source de calcul, DA4) : on ne le recalcule jamais
// ici, on additionne juste les parts déjà calculées.
//
// T-CR4 (décision produit 09/07/2026) : le champ Aide n'est proposé que pour
// la catégorie loyer (restriction UI seulement, `aid` reste générique côté
// domaine) ; sélecteur bénéficiaire étendu avec « les 2 », raccourci de saisie
// qui appelle `addAid` deux fois (`aid-split.ts`) — jamais un nouveau champ.

import { useState } from "react";
import { addAidAction, removeAidAction } from "../../actions";
import { formatAmountEUR } from "@app/shared";
import type { AidDTO } from "@app/domain-aid";
import type { Category } from "@app/domain-expense";
import type { MemberShare } from "../../../lib/household";
import { parseAmountToCents } from "../../../lib/amount";
import { BOTH_BENEFICIARIES, splitBothCents } from "./aid-split";
import { Button, Input } from "../design-system/core";
import { AmountDisplay } from "../design-system/balance";
import { Notice, useGlobalTransition } from "../design-system/feedback";
import { Stack } from "../design-system/layout";
import nativeSelectStyles from "../design-system/core/native-select.module.css";

type ShareDTO = { memberId: string; cents: number; pctSnapshot: number };

type Props = {
  expenseId: string;
  grossCents: number;
  category: Category;
  currentMemberId: string;
  members: MemberShare[];
  initialAids: AidDTO[];
  onSharesUpdated: (shares: ShareDTO[]) => void;
};

/** « que tu touches » / « que Camille touche » — jamais le mot « bénéficiaire ». */
function toucheVerb(
  beneficiaryId: string,
  currentMemberId: string,
  members: MemberShare[],
): string {
  if (beneficiaryId === currentMemberId) return "que tu touches";
  const name = members.find((m) => m.memberId === beneficiaryId)?.displayName ?? "l'autre";
  return `que ${name} touche`;
}

/**
 * Phrase d'explication (spec 8.2) : un chiffre, un résultat, jamais la formule.
 * `remainingCents` = Σ des parts déjà recomputées par calc-engine (jamais recalculé ici).
 */
function explanationSentence(
  aid: { label: string; amountCents: number; beneficiaryId: string },
  currentMemberId: string,
  members: MemberShare[],
  remainingCents: number,
  grossCents: number,
): string {
  const verb = toucheVerb(aid.beneficiaryId, currentMemberId, members);
  return `${aid.label} de ${formatAmountEUR(aid.amountCents)} ${verb} sert à la dépense commune. On ne partage que ce qui reste : ${formatAmountEUR(remainingCents)} au lieu de ${formatAmountEUR(grossCents)}.`;
}

/** Variante « les 2 » (T-CR4) : les 2 montants sont énoncés, toujours un résultat, jamais la formule. */
function explanationSentenceBoth(
  label: string,
  firstCents: number,
  secondCents: number,
  otherName: string,
  remainingCents: number,
  grossCents: number,
): string {
  return `${label} de ${formatAmountEUR(firstCents)} que tu touches et ${formatAmountEUR(secondCents)} que ${otherName} touche servent à la dépense commune. On ne partage que ce qui reste : ${formatAmountEUR(remainingCents)} au lieu de ${formatAmountEUR(grossCents)}.`;
}

function sumCents(shares: ShareDTO[]): number {
  return shares.reduce((s, x) => s + x.cents, 0);
}

export function AidSection({
  expenseId,
  grossCents,
  category,
  currentMemberId,
  members,
  initialAids,
  onSharesUpdated,
}: Props) {
  // Initialisées depuis la prop (aides déjà en base, T-C5.5) — plus jamais un
  // état qui repart vide au chargement alors que l'aide existe toujours en base.
  const [aids, setAids] = useState<AidDTO[]>(initialAids);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useGlobalTransition();
  const [open, setOpen] = useState(false);

  // État contrôlé requis par `Input` (design-system/core, T-CD2.2) — même
  // raison que expenses-panel.tsx : pas de prop `name` sur `Input`.
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [beneficiary, setBeneficiary] = useState<string>(currentMemberId);

  const otherMember = members.find((m) => m.memberId !== currentMemberId);
  // Restriction UI T-CR4 (decisions-techniques.md, 09/07) : aide proposée
  // seulement pour le loyer. Le modèle reste générique — une aide déjà posée
  // sur une autre catégorie (avant cette carte) reste gérable/retirable ici.
  const canAddAid = category === "loyer";
  if (!canAddAid && aids.length === 0) return null;

  function handleAdd() {
    setError(null);
    const trimmedLabel = label.trim();
    const amountCents = parseAmountToCents(amount);
    if (amountCents === null) {
      setError("montant invalide");
      return;
    }

    startTransition(async () => {
      if (beneficiary === BOTH_BENEFICIARIES && otherMember) {
        // « Les 2 » (T-CR4) : raccourci de saisie, appelle addAid deux fois —
        // aucun nouveau champ, aucun calcul ici (`sumCents` ne fait qu'additionner
        // ce que calc-engine a déjà recalculé côté serveur au 2e appel).
        const [firstCents, secondCents] = splitBothCents(amountCents);
        const firstResult = await addAidAction({
          expenseId,
          label: trimmedLabel,
          beneficiaryId: currentMemberId,
          amountCents: firstCents,
        });
        if (!firstResult.ok) {
          setError(firstResult.error.message);
          return;
        }
        const secondResult = await addAidAction({
          expenseId,
          label: trimmedLabel,
          beneficiaryId: otherMember.memberId,
          amountCents: secondCents,
        });
        if (!secondResult.ok) {
          setError(secondResult.error.message);
          return;
        }
        setAids(secondResult.data.aids);
        onSharesUpdated(secondResult.data.shares);
        setMessage(
          explanationSentenceBoth(
            trimmedLabel,
            firstCents,
            secondCents,
            otherMember.displayName,
            sumCents(secondResult.data.shares),
            grossCents,
          ),
        );
      } else {
        const result = await addAidAction({
          expenseId,
          label: trimmedLabel,
          beneficiaryId: beneficiary,
          amountCents,
        });
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        setAids(result.data.aids);
        onSharesUpdated(result.data.shares);
        setMessage(
          explanationSentence(
            { label: trimmedLabel, amountCents, beneficiaryId: beneficiary },
            currentMemberId,
            members,
            sumCents(result.data.shares),
            grossCents,
          ),
        );
      }
      setLabel("");
      setAmount("");
      setBeneficiary(currentMemberId);
    });
  }

  function handleRemove(aidId: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await removeAidAction({ expenseId, aidId });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setAids(result.data.aids);
      onSharesUpdated(result.data.shares);
    });
  }

  return (
    <Stack gap={2}>
      {/* Toujours replié par défaut : une dépense courante (resto) ne montre
          jamais les aides sans action explicite (T-C5.4). Déclencheur en
          `Button` (T-CD2.2, même pattern que BalanceDetailToggle T-CD2.1) —
          size par défaut (md, ~46px) pour ne pas régresser sous 44px. */}
      <Button variant="ghost" onClick={() => setOpen((prev) => !prev)}>
        options
      </Button>
      {open && (
        <Stack gap={2}>
            {aids.length > 0 ? (
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-1)",
                }}
              >
                {aids.map((a) => (
                  <li
                    key={a.id}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "var(--space-1)",
                    }}
                  >
                    <span>
                      {a.label} — <AmountDisplay value={formatAmountEUR(a.amountCents)} />
                    </span>
                    <Button
                      variant="secondary"
                      onClick={() => handleRemove(a.id)}
                      disabled={isPending}
                    >
                      retirer
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}

            {canAddAid ? (
              <form action={handleAdd}>
                <Stack gap={2}>
                  <Input
                    label="libellé"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="APL"
                  />
                  <Input
                    label="montant"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="200"
                    inputMode="decimal"
                    suffix="€"
                  />
                  <label className={nativeSelectStyles.wrapper}>
                    <span className={nativeSelectStyles.label}>qui la touche ?</span>
                    <select
                      className={nativeSelectStyles.select}
                      value={beneficiary}
                      onChange={(e) => setBeneficiary(e.target.value)}
                    >
                      <option value={currentMemberId}>toi</option>
                      {otherMember ? (
                        <>
                          <option value={otherMember.memberId}>{otherMember.displayName}</option>
                          <option value={BOTH_BENEFICIARIES}>les 2</option>
                        </>
                      ) : null}
                    </select>
                  </label>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "ajout…" : "ajouter l'aide"}
                  </Button>
                </Stack>
              </form>
            ) : null}

            {error ? <Notice tone="error">{error}</Notice> : null}
            {message ? <Notice tone="neutral">{message}</Notice> : null}
          </Stack>
      )}
    </Stack>
  );
}

