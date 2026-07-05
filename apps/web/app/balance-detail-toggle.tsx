"use client";

// Détail dépliable de transparence (spec 8.3, D-UX2, T-C4.4). Déclencheur textuel
// explicite « Pourquoi ? » (H5 — jamais une icône muette), toujours visible, replié
// par défaut. Décomposition « en deux temps » par dépense contributive, en langage
// humain uniquement : jamais "charge nette", "ratio", "contribution", ni équation.

import { useState, useTransition } from "react";
import { getBalanceDetailAction } from "./actions";
import { formatAmountEUR } from "@app/shared";
import type { BalanceDetailLine } from "@app/domain-expense";
import styles from "./balance-detail-toggle.module.css";

type Props = {
  currentMemberId: string;
  otherDisplayName: string;
  totalMessage: string;
};

/** « moitié-moitié » à 50/50, sinon une répartition énoncée en pourcentages. */
function splitWord(otherPct: number): string {
  return otherPct === 50 ? "partagé moitié-moitié" : `partagé ${otherPct} % / ${100 - otherPct} %`;
}

/** « la moitié » à 50/50, sinon un pourcentage — jamais de formule. */
function fractionWord(pct: number): string {
  return pct === 50 ? "la moitié" : `${pct} %`;
}

function pctOf(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

/** 1er temps (8.3) : répartition du montant brut, comme s'il n'y avait aucune aide. */
function baseLine(line: BalanceDetailLine, currentMemberId: string, otherDisplayName: string): string {
  const isCurrentPayer = line.payerId === currentMemberId;
  const payerLabel = isCurrentPayer ? "toi" : otherDisplayName;
  const otherPct = pctOf(line.baseOwedCents, line.grossCents);
  const result = isCurrentPayer
    ? `${otherDisplayName} te doit ${formatAmountEUR(line.baseOwedCents)}`
    : `Tu dois ${formatAmountEUR(line.baseOwedCents)} à ${payerLabel}`;
  return `${line.label} ${formatAmountEUR(line.grossCents)}, payé par ${payerLabel}, ${splitWord(otherPct)} → ${result}.`;
}

/** 2e temps (8.3) : chaque aide réajuste le montant du 1er temps. */
function aidLine(
  line: BalanceDetailLine,
  aid: BalanceDetailLine["aidLines"][number],
  currentMemberId: string,
  otherDisplayName: string,
): string {
  const isCurrentBeneficiary = aid.beneficiaryId === currentMemberId;
  const isPayerBeneficiary = aid.beneficiaryId === line.payerId;
  const toucheVerb = isCurrentBeneficiary ? "tu touches" : `${otherDisplayName} touche`;
  const frac = fractionWord(pctOf(aid.sharedCents, aid.aidCents));
  const amount = formatAmountEUR(aid.sharedCents);

  // Bénéficiaire = payeur → il rend la part de l'autre (le solde diminue).
  // Bénéficiaire = non-payeur → il doit en plus sa part du bénéfice (le solde augmente).
  const result = isPayerBeneficiary
    ? isCurrentBeneficiary
      ? `tu lui en rends ${frac}, ${amount}`
      : `${otherDisplayName} t'en rend ${frac}, ${amount}`
    : isCurrentBeneficiary
      ? `tu en dois ${frac} de plus, ${amount}`
      : `${otherDisplayName} t'en doit ${frac} de plus, ${amount}`;

  return `${aid.label} ${formatAmountEUR(aid.aidCents)} que ${toucheVerb} → ${result}.`;
}

export function BalanceDetailToggle({ currentMemberId, otherDisplayName, totalMessage }: Props) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<BalanceDetailLine[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    setOpen((prev) => !prev);
    if (lines === null) {
      startTransition(async () => {
        const res = await getBalanceDetailAction();
        setLines(res.ok ? res.data : []);
      });
    }
  };

  return (
    <div>
      <button type="button" className={styles.trigger} onClick={handleClick}>
        Pourquoi ?
      </button>
      {open && (
        <div className={styles.detail}>
          {isPending || lines === null ? (
            <p className={styles.line}>Calcul en cours…</p>
          ) : (
            <>
              {lines.map((line, i) => (
                <p className={styles.line} key={i}>
                  {baseLine(line, currentMemberId, otherDisplayName)}
                  {line.aidLines.map((aid, j) => (
                    <span key={j}>
                      <br />
                      {aidLine(line, aid, currentMemberId, otherDisplayName)}
                    </span>
                  ))}
                </p>
              ))}
              <p className={styles.total}>Total : {totalMessage}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
