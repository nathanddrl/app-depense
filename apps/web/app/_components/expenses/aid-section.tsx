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

import { useState, useTransition } from "react";
import { addAidAction, removeAidAction } from "../../actions";
import { formatAmountEUR } from "@app/shared";
import type { AidDTO } from "@app/domain-aid";
import type { MemberShare } from "../../../lib/household";
import { Button, Input } from "../design-system/core";
import { AmountDisplay } from "../design-system/balance";
import { Notice } from "../design-system/feedback";

type ShareDTO = { memberId: string; cents: number; pctSnapshot: number };

type Props = {
  expenseId: string;
  grossCents: number;
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

function sumCents(shares: ShareDTO[]): number {
  return shares.reduce((s, x) => s + x.cents, 0);
}

export function AidSection({
  expenseId,
  grossCents,
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
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  // État contrôlé requis par `Input` (design-system/core, T-CD2.2) — même
  // raison que expenses-panel.tsx : pas de prop `name` sur `Input`.
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [beneficiaryId, setBeneficiaryId] = useState(currentMemberId);

  function handleAdd() {
    setError(null);
    const trimmedLabel = label.trim();
    const amountCents = Math.round(Number.parseFloat(amount.replace(",", ".")) * 100);

    startTransition(async () => {
      const result = await addAidAction({
        expenseId,
        label: trimmedLabel,
        beneficiaryId,
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
          { label: trimmedLabel, amountCents, beneficiaryId },
          currentMemberId,
          members,
          sumCents(result.data.shares),
          grossCents,
        ),
      );
      setLabel("");
      setAmount("");
      setBeneficiaryId(currentMemberId);
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
    <div>
      {/* Toujours replié par défaut : une dépense courante (resto) ne montre
          jamais les aides sans action explicite (T-C5.4). Déclencheur en
          `Button` (T-CD2.2, même pattern que BalanceDetailToggle T-CD2.1) —
          size par défaut (md, ~46px) pour ne pas régresser sous 44px. */}
      <Button variant="ghost" onClick={() => setOpen((prev) => !prev)}>
        Options
      </Button>
      {open && (
        <div style={{ marginTop: "var(--space-2)" }}>
          {aids.length > 0 ? (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                marginBottom: "var(--space-1)",
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
                  <Button variant="secondary" onClick={() => handleRemove(a.id)} disabled={isPending}>
                    Retirer
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          <form
            action={handleAdd}
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}
          >
            <Input label="Libellé" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="APL" />
            <Input
              label="Montant"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="200"
              suffix="€"
            />
            <label>
              Qui la touche ?
              <select value={beneficiaryId} onChange={(e) => setBeneficiaryId(e.target.value)}>
                <option value={currentMemberId}>Toi</option>
                {members
                  .filter((m) => m.memberId !== currentMemberId)
                  .map((m) => (
                    <option key={m.memberId} value={m.memberId}>
                      {m.displayName}
                    </option>
                  ))}
              </select>
            </label>
            {error ? <Notice tone="error">{error}</Notice> : null}
            <Button type="submit" disabled={isPending}>
              {isPending ? "Ajout…" : "Ajouter l'aide"}
            </Button>
          </form>

          {message ? <Notice tone="neutral">{message}</Notice> : null}
        </div>
      )}
    </div>
  );
}
