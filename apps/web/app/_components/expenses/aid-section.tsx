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
import styles from "./aid-section.module.css";

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

  function handleAdd(formData: FormData) {
    setError(null);
    const label = String(formData.get("label") ?? "").trim();
    const amountEUR = String(formData.get("amount") ?? "");
    const beneficiaryId = String(formData.get("beneficiaryId") ?? currentMemberId);
    const amountCents = Math.round(Number.parseFloat(amountEUR.replace(",", ".")) * 100);

    startTransition(async () => {
      const result = await addAidAction({ expenseId, label, beneficiaryId, amountCents });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setAids(result.data.aids);
      onSharesUpdated(result.data.shares);
      setMessage(
        explanationSentence(
          { label, amountCents, beneficiaryId },
          currentMemberId,
          members,
          sumCents(result.data.shares),
          grossCents,
        ),
      );
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
    <details>
      {/* Toujours replié par défaut (natif <details>) : une dépense courante
          (resto) ne montre jamais les aides sans action explicite (T-C5.4). */}
      <summary className={styles.trigger}>Options</summary>
      <div className={styles.content}>
        {aids.length > 0 ? (
          <ul className={styles.list}>
            {aids.map((a) => (
              <li key={a.id} className={styles.item}>
                <span>
                  {a.label} — {formatAmountEUR(a.amountCents)}
                </span>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => handleRemove(a.id)}
                  disabled={isPending}
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <form action={handleAdd} className={styles.form}>
          <label>
            Libellé
            <input type="text" name="label" required placeholder="APL" />
          </label>
          <label>
            Montant (€)
            <input type="text" name="amount" inputMode="decimal" required placeholder="200" />
          </label>
          <label>
            Qui la touche ?
            <select name="beneficiaryId" defaultValue={currentMemberId}>
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
          {error ? <p role="alert">{error}</p> : null}
          <button type="submit" className={styles.button} disabled={isPending}>
            {isPending ? "Ajout…" : "Ajouter l'aide"}
          </button>
        </form>

        {message ? <p className={styles.message}>{message}</p> : null}
      </div>
    </details>
  );
}
