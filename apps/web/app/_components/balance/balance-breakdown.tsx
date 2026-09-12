"use client";

// Écran « d'où vient l'écart » (refonte solde, remplace l'ancien détail
// dépliable `balance-detail-toggle.tsx`). Trois niveaux de profondeur — membre
// → catégorie → dépense —, un seul geste pour descendre (tap sur une part du
// donut), un fil d'ariane pour remonter. Le donut encode « qui a payé le
// plus » (brut), PAS « qui a payé plus que sa part » : ces deux grandeurs
// divergent dès qu'un partage n'est pas 50/50 ou qu'une aide entre en jeu
// (assumé — compensé par le solde, toujours affiché en toutes lettres au
// centre du donut, jamais laissé à déduire du dessin).
//
// Continuité de l'animation entre niveaux (spec non négociable) : chaque
// transition mémorise l'angle de la part tapée (`memberOrigin`/`categoryOrigin`)
// et le rejoue en sens inverse en remontant par le fil d'ariane — le Donut
// n'a besoin que d'un seul angle de convergence (`transitionOrigin`) par
// changement de niveau, jamais d'un id-matching entre membres/catégories/
// dépenses (namespaces disjoints par construction).

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getBalanceBreakdownAction, type BalanceBreakdown } from "../../actions";
import { formatAmountEUR, formatDateFr } from "@app/shared";
import type { Category } from "@app/domain-expense";
import { formatBalanceMessage, memberDisplayName, type MemberShare } from "../../../lib/household";
import { Button } from "../design-system/core";
import { AmountDisplay, BalanceStatement } from "../design-system/balance";
import { Dialog, Notice, useGlobalTransition } from "../design-system/feedback";
import { Stack } from "../design-system/layout";
import { Donut, computeSliceAngles, sliceMidAngle, type DonutSlice } from "../design-system/charts";
import {
  getMemberChartColorVar,
  getCategoryChartColorVar,
  getExpenseChartColorVar,
} from "./balance-breakdown-colors";
import styles from "./balance-breakdown.module.css";

type Level = 1 | 2 | 3;

/** Niveau 1 : comparaison des montants bruts payés — distincte du solde
 * (centre du donut), jamais réduite à « qui doit quoi ». */
function level1Phrase(data: BalanceBreakdown, members: MemberShare[]): string | null {
  const [a, b] = data.members;
  if (!a || !b) return null;
  const nameA = memberDisplayName(members, a.memberId);
  const nameB = memberDisplayName(members, b.memberId);
  const diff = a.totalCents - b.totalCents;
  if (diff === 0) return `${nameA} et ${nameB} ont payé autant l'un que l'autre sur cette période`;
  const [moreName, lessName, amount] = diff > 0 ? [nameA, nameB, diff] : [nameB, nameA, -diff];
  return `${moreName} a payé ${formatAmountEUR(amount)} de plus que ${lessName} sur cette période`;
}

function level2Phrase(
  member: BalanceBreakdown["members"][number] | undefined,
  memberName: string,
): string | null {
  const top = member?.categories[0];
  if (!top) return null;
  return `${memberName} a surtout payé en ${top.category}, ${formatAmountEUR(top.totalCents)} sur la période`;
}

function level3Phrase(
  category: BalanceBreakdown["members"][number]["categories"][number] | undefined,
  memberName: string,
): string | null {
  if (!category) return null;
  const count = category.expenses.length;
  return `${count} dépense${count > 1 ? "s" : ""} de ${memberName} en ${category.category}, ${formatAmountEUR(category.totalCents)} au total`;
}

/**
 * Rend explicite la borne basse de la période du donut (depuis la dernière
 * régularisation confirmée, ou depuis le début s'il n'y en a jamais eu) —
 * sans ça, le total du donut (une fenêtre récente) et le solde au centre
 * (cumulé depuis toujours, modèle ledger) semblent incohérents entre eux.
 */
function periodLabel(periodStart: string | null): string {
  if (!periodStart) return "depuis le début";
  return `depuis le ${formatDateFr(new Date(periodStart))}`;
}

type ScreenProps = {
  data: BalanceBreakdown;
  currentMemberId: string;
  members: MemberShare[];
  settlementControls: ReactNode;
  onClose: () => void;
};

export function BalanceBreakdownScreen({
  data,
  currentMemberId,
  members,
  settlementControls,
  onClose,
}: ScreenProps) {
  const router = useRouter();
  const [, startTransition] = useGlobalTransition();

  const [level, setLevel] = useState<Level>(1);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [memberOrigin, setMemberOrigin] = useState(-90);
  const [categoryOrigin, setCategoryOrigin] = useState(-90);
  const [transitionOrigin, setTransitionOrigin] = useState(-90);

  const message = formatBalanceMessage(data.balance, members, currentMemberId);
  const periodTotal = data.members.reduce((sum, m) => sum + m.totalCents, 0);

  if (periodTotal === 0) {
    return (
      <Stack gap={3}>
        <BalanceStatement>{message}</BalanceStatement>
        <Notice>aucune dépense enregistrée {periodLabel(data.periodStart)}</Notice>
        <Button
          variant="primary"
          onClick={() => {
            onClose();
            startTransition(() => router.push("/ajouter"));
          }}
        >
          ajouter une dépense
        </Button>
      </Stack>
    );
  }

  function goToLevel1() {
    setTransitionOrigin(memberOrigin);
    setSelectedMemberId(null);
    setSelectedCategory(null);
    setLevel(1);
  }

  function goToLevel2() {
    setTransitionOrigin(categoryOrigin);
    setSelectedCategory(null);
    setLevel(2);
  }

  function selectMember(memberId: string) {
    const angles = computeSliceAngles(
      data.members.map((m) => ({ id: m.memberId, valueCents: m.totalCents })),
    );
    const origin = angles.find((a) => a.id === memberId);
    const angle = origin ? sliceMidAngle(origin) : -90;
    setMemberOrigin(angle);
    setTransitionOrigin(angle);
    setSelectedMemberId(memberId);
    setSelectedCategory(null);
    setLevel(2);
  }

  function selectCategory(member: BalanceBreakdown["members"][number], category: Category) {
    const angles = computeSliceAngles(
      member.categories.map((c) => ({ id: c.category, valueCents: c.totalCents })),
    );
    const origin = angles.find((a) => a.id === category);
    const angle = origin ? sliceMidAngle(origin) : -90;
    setCategoryOrigin(angle);
    setTransitionOrigin(angle);
    setSelectedCategory(category);
    setLevel(3);
  }

  const selectedMember = data.members.find((m) => m.memberId === selectedMemberId);
  const selectedCategoryData = selectedMember?.categories.find(
    (c) => c.category === selectedCategory,
  );
  const selectedMemberName = selectedMemberId ? memberDisplayName(members, selectedMemberId) : "";

  const slices: DonutSlice[] =
    level === 1
      ? data.members.map((m, i) => ({
          id: m.memberId,
          label: memberDisplayName(members, m.memberId),
          valueCents: m.totalCents,
          color: getMemberChartColorVar(i),
          onSelect: () => selectMember(m.memberId),
        }))
      : level === 2
        ? (selectedMember?.categories ?? []).map((c) => ({
            id: c.category,
            label: c.category,
            valueCents: c.totalCents,
            color: getCategoryChartColorVar(c.category),
            onSelect: () => selectedMember && selectCategory(selectedMember, c.category),
          }))
        : (selectedCategoryData?.expenses ?? []).map((e, i) => ({
            id: e.id,
            label: e.label,
            valueCents: e.cents,
            color: getExpenseChartColorVar(selectedCategory ?? "", i),
          }));

  const nestedEmpty = level > 1 && slices.length === 0;

  const centerContent =
    level === 1 ? (
      <BalanceStatement size="sm">{message}</BalanceStatement>
    ) : level === 2 ? (
      <Stack gap={1}>
        <span className={styles.centerLabel}>{selectedMemberName}</span>
        <AmountDisplay value={formatAmountEUR(selectedMember?.totalCents ?? 0)} size="lg" />
      </Stack>
    ) : (
      <Stack gap={1}>
        <span className={styles.centerLabel}>{selectedCategory}</span>
        <AmountDisplay value={formatAmountEUR(selectedCategoryData?.totalCents ?? 0)} size="lg" />
      </Stack>
    );

  const phrase =
    level === 1
      ? level1Phrase(data, members)
      : level === 2
        ? level2Phrase(selectedMember, selectedMemberName)
        : level3Phrase(selectedCategoryData, selectedMemberName);

  const breadcrumb: { label: string; onClick?: () => void }[] = [
    { label: "tout", onClick: level > 1 ? goToLevel1 : undefined },
    ...(selectedMemberId
      ? [{ label: selectedMemberName, onClick: level > 2 ? goToLevel2 : undefined }]
      : []),
    ...(level === 3 && selectedCategory ? [{ label: selectedCategory }] : []),
  ];

  return (
    <Stack gap={3}>
      <Stack direction="row" gap={1} wrap>
        {breadcrumb.map((item, i) => (
          <span key={`${item.label}-${i}`} className={styles.breadcrumbItem}>
            {i > 0 ? (
              <span aria-hidden="true" className={styles.separator}>
                ›
              </span>
            ) : null}
            {item.onClick ? (
              <Button variant="ghost" size="sm" onClick={item.onClick}>
                {item.label}
              </Button>
            ) : (
              <span className={styles.breadcrumbCurrent}>{item.label}</span>
            )}
          </span>
        ))}
      </Stack>

      <p className={styles.periodLabel}>{periodLabel(data.periodStart)}</p>

      {nestedEmpty ? (
        <Notice>
          {selectedMemberName} n&apos;a rien payé {periodLabel(data.periodStart)}
        </Notice>
      ) : (
        <Donut slices={slices} centerContent={centerContent} transitionOrigin={transitionOrigin} />
      )}

      {phrase ? <Notice tone="neutral">{phrase}</Notice> : null}

      {level === 1 ? settlementControls : null}
    </Stack>
  );
}

type TriggerProps = {
  currentMemberId: string;
  members: MemberShare[];
  settlementControls: ReactNode;
};

export function BalanceBreakdownTrigger({
  currentMemberId,
  members,
  settlementControls,
}: TriggerProps) {
  const [open, setOpen] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [data, setData] = useState<BalanceBreakdown | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isPending, startTransition] = useGlobalTransition();

  function handleOpen() {
    setOpen(true);
    setData(null);
    setLoadError(false);
    setOpenCount((c) => c + 1);
    startTransition(async () => {
      const res = await getBalanceBreakdownAction();
      if (res.ok) setData(res.data);
      else setLoadError(true);
    });
  }

  return (
    <>
      <Button variant="ghost" onClick={handleOpen}>
        d&apos;où vient l&apos;écart
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullscreen title="d'où vient l'écart">
        {loadError ? (
          <Notice tone="error">le calcul a échoué, réessaie dans un instant</Notice>
        ) : isPending || data === null ? (
          <Notice tone="neutral">calcul en cours…</Notice>
        ) : (
          <BalanceBreakdownScreen
            key={openCount}
            data={data}
            currentMemberId={currentMemberId}
            members={members}
            settlementControls={settlementControls}
            onClose={() => setOpen(false)}
          />
        )}
      </Dialog>
    </>
  );
}
