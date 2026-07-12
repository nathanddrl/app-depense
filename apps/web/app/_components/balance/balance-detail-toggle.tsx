"use client";

// Détail dépliable de transparence (spec 8.3, D-UX2, T-C4.4). Déclencheur textuel
// explicite « Pourquoi ? » (H5 — jamais une icône muette), toujours visible, replié
// par défaut. Décomposition « en deux temps » par dépense contributive, en langage
// humain uniquement : jamais "charge nette", "ratio", "contribution", ni équation.
//
// Les dépenses ponctuelles (une seule fois, sans aide) sont résumées en une phrase
// agrégée plutôt que détaillées une par une — trop long sinon. Le « régulier »
// (récurrent et/ou ajusté par une aide) reste toujours détaillé en clair : c'est
// là que la mécanique (répartition, aide) a besoin d'être visible ligne par ligne.
// Un bouton « voir le détail » ouvre à la demande la même décomposition pour les
// ponctuelles, dans une modal (par-dessus le reste, fermable) — chaque ligne y est
// doublée d'un schéma WaterLine (7) plutôt que du seul texte, pour rester lisible
// d'un coup d'œil.

import { useState, useTransition, type ReactNode } from "react";
import { getBalanceDetailAction } from "../../actions";
import { formatAmountEUR } from "@app/shared";
import type { BalanceDetailLine } from "@app/domain-expense";
import { Button } from "../design-system/core";
import { AmountDisplay, WaterLine } from "../design-system/balance";
import { Dialog, Notice } from "../design-system/feedback";
import { Stack } from "../design-system/layout";

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

/** Magnitude WaterLine (7) propre à une ligne : poids du solde final de cette
 * dépense au sein de son propre montant (0 = neutre, ±1 = tout part d'un côté),
 * signé selon la perspective du lecteur — même logique que water-line-magnitude.ts
 * mais normalisée par la dépense elle-même, pas par un montant de référence global. */
function oneOffLineMagnitude(line: BalanceDetailLine, currentMemberId: string): number {
  if (line.grossCents === 0) return 0;
  const normalized = Math.min(line.totalOwedCents / line.grossCents, 1);
  if (normalized === 0) return 0;
  return line.payerId === currentMemberId ? normalized : -normalized;
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
  const resultPrefix = isCurrentPayer ? `${otherDisplayName} te doit ` : "tu dois ";
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

/** Une dépense reste toujours détaillée (2e temps compris) si elle revient chaque
 * mois ou si une aide vient l'ajuster — le reste (ponctuel) n'est que résumé,
 * pour ne pas noyer l'explication sous une décomposition dépense par dépense. */
function isRegular(line: BalanceDetailLine): boolean {
  return line.source === "recurring" || line.aidLines.length > 0;
}

/** Résumé du seul solde net des dépenses ponctuelles, même ton que le solde global. */
function oneOffSummary(
  oneOffLines: BalanceDetailLine[],
  currentMemberId: string,
  otherDisplayName: string,
): ReactNode {
  const netForCurrent = oneOffLines.reduce(
    (sum, line) =>
      sum + (line.payerId === currentMemberId ? line.totalOwedCents : -line.totalOwedCents),
    0,
  );
  if (netForCurrent === 0) {
    return "au total, tes dépenses ponctuelles s'équilibrent";
  }
  const amount = formatAmountEUR(Math.abs(netForCurrent));
  return netForCurrent > 0 ? (
    <>
      au total, tes dépenses ponctuelles font que {otherDisplayName} te doit{" "}
      <AmountDisplay value={amount} size="sm" />
    </>
  ) : (
    <>
      au total, tes dépenses ponctuelles font que tu dois <AmountDisplay value={amount} size="sm" /> à{" "}
      {otherDisplayName}
    </>
  );
}

export function BalanceDetailToggle({ currentMemberId, otherDisplayName, totalMessage }: Props) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<BalanceDetailLine[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const handleClick = () => {
    setOpen((prev) => !prev);
    if (lines === null) {
      startTransition(async () => {
        const res = await getBalanceDetailAction();
        setLines(res.ok ? res.data : []);
      });
    }
  };

  const regularLines = lines?.filter(isRegular) ?? [];
  const oneOffLines = lines?.filter((line) => !isRegular(line)) ?? [];

  return (
    <Stack gap={2}>
      <Button variant="ghost" onClick={handleClick}>
        pourquoi ?
      </Button>
      {open && (
        <Stack gap={1}>
          {isPending || lines === null ? (
            <Notice tone="neutral">calcul en cours…</Notice>
          ) : (
            <>
              {oneOffLines.length > 0 && (
                <Notice tone="neutral">
                  {oneOffSummary(oneOffLines, currentMemberId, otherDisplayName)}
                </Notice>
              )}
              {oneOffLines.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setDetailModalOpen(true)}>
                  voir le détail
                </Button>
              )}
              {regularLines.map((line, i) => (
                <Notice tone="neutral" key={`reguliere-${i}`}>
                  {baseLine(line, currentMemberId, otherDisplayName)}
                  {line.aidLines.map((aid, j) => (
                    <span key={j}>
                      <br />
                      {aidLine(line, aid, currentMemberId, otherDisplayName)}
                    </span>
                  ))}
                </Notice>
              ))}
              <Notice tone="neutral">total : {totalMessage}</Notice>
            </>
          )}
        </Stack>
      )}
      <Dialog
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title="dépenses ponctuelles"
      >
        <Stack gap={3}>
          {oneOffLines.map((line, i) => (
            <Stack gap={1} key={`ponctuelle-modal-${i}`}>
              <WaterLine magnitude={oneOffLineMagnitude(line, currentMemberId)} height={40} />
              <Notice tone="neutral">{baseLine(line, currentMemberId, otherDisplayName)}</Notice>
            </Stack>
          ))}
        </Stack>
      </Dialog>
    </Stack>
  );
}
