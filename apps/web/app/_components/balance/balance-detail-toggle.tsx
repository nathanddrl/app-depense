"use client";

// Détail dépliable de transparence (spec 8.3, D-UX2, T-C4.4). Déclencheur textuel
// explicite « Pourquoi ? » (H5 — jamais une icône muette), toujours visible, replié
// par défaut. Décomposition « en deux temps » par dépense contributive, en langage
// humain uniquement : jamais "charge nette", "ratio", "contribution", ni équation.

import { useState, useTransition, type ReactNode } from "react";
import { getBalanceDetailAction } from "../../actions";
import { formatAmountEUR } from "@app/shared";
import type { BalanceDetailLine } from "@app/domain-expense";
import { Button } from "../design-system/core";
import { AmountDisplay } from "../design-system/balance";
import { Notice } from "../design-system/feedback";

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

/** 1er temps (8.3) : répartition du montant brut, comme s'il n'y avait aucune aide.
 * Montants en `AmountDisplay` (T-CD2.1) — le reste de la phrase est inchangé mot pour mot. */
function baseLine(
  line: BalanceDetailLine,
  currentMemberId: string,
  otherDisplayName: string,
): ReactNode {
  const isCurrentPayer = line.payerId === currentMemberId;
  const payerLabel = isCurrentPayer ? "toi" : otherDisplayName;
  const otherPct = pctOf(line.baseOwedCents, line.grossCents);
  const resultPrefix = isCurrentPayer ? `${otherDisplayName} te doit ` : "Tu dois ";
  const resultSuffix = isCurrentPayer ? "" : ` à ${payerLabel}`;
  return (
    <>
      {line.label} <AmountDisplay value={formatAmountEUR(line.grossCents)} size="sm" />
      {`, payé par ${payerLabel}, ${splitWord(otherPct)} → ${resultPrefix}`}
      <AmountDisplay value={formatAmountEUR(line.baseOwedCents)} size="sm" />
      {resultSuffix}.
    </>
  );
}

/** 2e temps (8.3) : chaque aide réajuste le montant du 1er temps. Montants en
 * `AmountDisplay` (T-CD2.1) — le reste de la phrase est inchangé mot pour mot. */
function aidLine(
  line: BalanceDetailLine,
  aid: BalanceDetailLine["aidLines"][number],
  currentMemberId: string,
  otherDisplayName: string,
): ReactNode {
  const isCurrentBeneficiary = aid.beneficiaryId === currentMemberId;
  const isPayerBeneficiary = aid.beneficiaryId === line.payerId;
  const toucheVerb = isCurrentBeneficiary ? "tu touches" : `${otherDisplayName} touche`;
  const frac = fractionWord(pctOf(aid.sharedCents, aid.aidCents));

  // Bénéficiaire = payeur → il rend la part de l'autre (le solde diminue).
  // Bénéficiaire = non-payeur → il doit en plus sa part du bénéfice (le solde augmente).
  const resultPrefix = isPayerBeneficiary
    ? isCurrentBeneficiary
      ? `tu lui en rends ${frac}, `
      : `${otherDisplayName} t'en rend ${frac}, `
    : isCurrentBeneficiary
      ? `tu en dois ${frac} de plus, `
      : `${otherDisplayName} t'en doit ${frac} de plus, `;

  return (
    <>
      {aid.label} <AmountDisplay value={formatAmountEUR(aid.aidCents)} size="sm" />
      {` que ${toucheVerb} → ${resultPrefix}`}
      <AmountDisplay value={formatAmountEUR(aid.sharedCents)} size="sm" />.
    </>
  );
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
      <Button variant="ghost" onClick={handleClick}>
        Pourquoi ?
      </Button>
      {open && (
        <div style={{ marginTop: "var(--space-2)" }}>
          {isPending || lines === null ? (
            <Notice tone="neutral">Calcul en cours…</Notice>
          ) : (
            <>
              {lines.map((line, i) => (
                <div style={{ marginBottom: "var(--space-1)" }} key={i}>
                  <Notice tone="neutral">
                    {baseLine(line, currentMemberId, otherDisplayName)}
                    {line.aidLines.map((aid, j) => (
                      <span key={j}>
                        <br />
                        {aidLine(line, aid, currentMemberId, otherDisplayName)}
                      </span>
                    ))}
                  </Notice>
                </div>
              ))}
              <Notice tone="neutral">Total : {totalMessage}</Notice>
            </>
          )}
        </div>
      )}
    </div>
  );
}
