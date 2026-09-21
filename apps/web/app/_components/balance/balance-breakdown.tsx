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

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getBalanceBreakdownAction, type BalanceBreakdown } from "../../actions";
import { formatAmountEUR, formatDateFr, formatDateShortFr } from "@app/shared";
import type { Category } from "@app/domain-expense";
import { formatBalanceMessage, memberDisplayName, type MemberShare } from "../../../lib/household";
import { Button } from "../design-system/core";
import { AmountDisplay, BalanceStatement } from "../design-system/balance";
import { Dialog, Notice, useGlobalTransition } from "../design-system/feedback";
import { Stack } from "../design-system/layout";
import { Donut, computeSliceAngles, sliceMidAngle, type DonutSlice } from "../design-system/charts";
import {
  getMemberChartColorVar,
  assignCategoryChartColors,
  getExpenseChartColorVar,
} from "./balance-breakdown-colors";
import styles from "./balance-breakdown.module.css";

type Level = 1 | 2 | 3;

const FETCH_TIMEOUT_MS = 20_000;

/** Part de l'écart (par rapport au total payé sur la période) à partir de
 * laquelle le centre du donut affiche le vrai montant ; en dessous, « presque
 * étale ». Un écart nul garde la formule canonique. */
const ALMOST_ETALE_THRESHOLD = 0.15;

function level1CenterMessage(
  balance: BalanceBreakdown["balance"],
  periodTotal: number,
  members: MemberShare[],
  currentMemberId: string,
): string {
  const ratio = periodTotal > 0 ? balance.amountCents / periodTotal : 0;
  if (balance.amountCents !== 0 && ratio < ALMOST_ETALE_THRESHOLD) return "presque étale";
  return formatBalanceMessage(balance, members, currentMemberId);
}

/** Niveau 1 : le solde exprimé en « payé en plus de sa part » — exact quels
 * que soient le ratio de partage et les aides (contrairement à un écart brut
 * entre payeurs). Solde nul : pas de constat, le centre du donut dit déjà
 * « vous êtes étale ». */
function level1Phrase(
  data: BalanceBreakdown,
  members: MemberShare[],
  currentMemberId: string,
): string | null {
  const { amountCents, to } = data.balance;
  if (amountCents === 0) return null;
  const amount = formatAmountEUR(amountCents);
  if (to === currentMemberId) return `tu as payé ${amount} de plus que ta part`;
  return `${memberDisplayName(members, to)} a payé ${amount} de plus que sa part`;
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

  // Le contrôle qui vient d'être activé (arc du donut, item du fil d'ariane)
  // disparaît du DOM au changement de niveau : sans ça le focus retomberait
  // sur <body> et le prochain Tab partirait derrière l'écran. Le conteneur
  // (stable, jamais démonté) reprend le focus ; Tab enchaîne ensuite sur le
  // fil d'ariane puis sur les arcs du nouveau niveau.
  const contentRef = useRef<HTMLDivElement>(null);
  const previousLevel = useRef<Level>(1);
  useEffect(() => {
    if (previousLevel.current === level) return;
    previousLevel.current = level;
    contentRef.current?.focus({ preventScroll: true });
  }, [level]);

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

  const categoryColors = assignCategoryChartColors(
    (selectedMember?.categories ?? []).map((c) => c.category),
  );

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
        ? (selectedMember?.categories ?? []).map((c, i) => ({
            id: c.category,
            label: c.category,
            valueCents: c.totalCents,
            color: categoryColors[i],
            onSelect: () => selectedMember && selectCategory(selectedMember, c.category),
          }))
        : (selectedCategoryData?.expenses ?? []).map((e, i) => ({
            id: e.id,
            label: `${e.label}, ${formatDateShortFr(e.incurredOn)}`,
            valueCents: e.cents,
            color: getExpenseChartColorVar(selectedCategory ?? "", i),
          }));

  const nestedEmpty = level > 1 && slices.length === 0;

  const centerContent =
    level === 1 ? (
      <BalanceStatement size="sm">
        {level1CenterMessage(data.balance, periodTotal, members, currentMemberId)}
      </BalanceStatement>
    ) : level === 2 ? (
      <Stack gap={1}>
        <span className={styles.centerLabel}>{selectedMemberName}</span>
        <AmountDisplay value={formatAmountEUR(selectedMember?.totalCents ?? 0)} weight="medium" />
      </Stack>
    ) : (
      <Stack gap={1}>
        <span className={styles.centerLabel}>{selectedCategory}</span>
        <AmountDisplay
          value={formatAmountEUR(selectedCategoryData?.totalCents ?? 0)}
          weight="medium"
        />
      </Stack>
    );

  const phrase =
    level === 1
      ? level1Phrase(data, members, currentMemberId)
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
    <div ref={contentRef} tabIndex={-1} className={styles.screen}>
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
          <Donut
            slices={slices}
            centerContent={centerContent}
            transitionOrigin={transitionOrigin}
          />
        )}

        {phrase ? <Notice tone="neutral">{phrase}</Notice> : null}

        {level === 1 ? settlementControls : null}
      </Stack>
    </div>
  );
}

type TriggerProps = {
  currentMemberId: string;
  members: MemberShare[];
  settlementControls: ReactNode;
  /** Change dès que le solde ou la régularisation courante changent (calculé
   * par BalanceCard) : l'écran ouvert se recharge, pour ne jamais afficher un
   * état périmé (ex. le créancier confirme « j'ai reçu » depuis cet écran). */
  revision: string;
};

export function BalanceBreakdownTrigger({
  currentMemberId,
  members,
  settlementControls,
  revision,
}: TriggerProps) {
  const [open, setOpen] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [data, setData] = useState<BalanceBreakdown | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const openerRef = useRef<HTMLElement | null>(null);

  // Chargement à l'ouverture, au réessai et à chaque changement de `revision`.
  // Une Server Action qui LÈVE (base injoignable, réseau) est traitée comme un
  // échec, au même titre qu'un `ok: false` — sans ça l'écran resterait sur
  // « calcul en cours… » pour toujours.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Backend qui ne répond pas (timeout amont de 60 s) : au-delà de ce délai,
    // l'écran passe en erreur plutôt que de rester sur « calcul en cours… ».
    // Une réponse tardive rétablit tout de même l'écran (ci-dessous).
    const timer = setTimeout(() => {
      if (!cancelled) setFailed(true);
    }, FETCH_TIMEOUT_MS);
    getBalanceBreakdownAction()
      .then((res) => {
        if (cancelled) return;
        clearTimeout(timer);
        if (res.ok) {
          setData(res.data);
          setFailed(false);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        clearTimeout(timer);
        setFailed(true);
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, attempt, revision]);

  function handleOpen() {
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setData(null);
    setFailed(false);
    setOpenCount((c) => c + 1);
    setOpen(true);
  }

  // Fermeture (Échap, « annuler », CTA) : le focus revient au déclencheur.
  function closeScreen() {
    setOpen(false);
    openerRef.current?.focus();
  }

  function retry() {
    setFailed(false);
    setAttempt((a) => a + 1);
  }

  return (
    <>
      <Button variant="ghost" onClick={handleOpen}>
        d&apos;où vient l&apos;écart
      </Button>
      <Dialog open={open} onClose={closeScreen} fullscreen title="d'où vient l'écart">
        {data ? (
          <Stack gap={3}>
            {failed ? (
              <Notice tone="error">les chiffres n&apos;ont pas pu être actualisés</Notice>
            ) : null}
            <BalanceBreakdownScreen
              key={openCount}
              data={data}
              currentMemberId={currentMemberId}
              members={members}
              settlementControls={settlementControls}
              onClose={closeScreen}
            />
          </Stack>
        ) : failed ? (
          <Stack gap={2}>
            <Notice tone="error">le calcul ne répond pas pour le moment</Notice>
            <Button variant="secondary" onClick={retry}>
              réessayer
            </Button>
          </Stack>
        ) : (
          <Notice tone="neutral">calcul en cours…</Notice>
        )}
      </Dialog>
    </>
  );
}
