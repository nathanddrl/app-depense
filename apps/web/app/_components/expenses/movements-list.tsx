"use client";

// Liste compacte de mouvements (CN2.2) : flux typographique direct sur
// --surface-base, séparé par des filets WaterSeparator étiquetés — jamais de
// Card par ligne ni autour du bloc. Groupé par jour par défaut (aperçu
// accueil, un seul séparateur si l'extrait tient sur un jour) ou par mois
// (`groupBy="month"`, écran /mouvements complet, T-CN3.1 — un historique de
// plusieurs mois est plus lisible avec un repère mensuel qu'un filet par
// jour). Badge « dépense qui revient chaque mois » (source==='recurring',
// T-CR3) : même traitement visuel que dans l'ancien HistorySection, ton
// neutre, jamais une couleur d'alerte.
//
// Édition d'aide après coup (T-CN5, ex-`history-section.tsx` mort depuis
// T-CN3.1) : `AidSection` se réaffiche sur une ligne loyer non verrouillée,
// même logique interne intacte (restriction catégorie, garde EXPENSE_LOCKED
// server-side) — ce composant se contente de ne PAS monter `AidSection` du
// tout pour une dépense verrouillée (`settlementId !== null`) ou hors loyer,
// pour que le point d'entrée n'existe même pas plutôt que d'échouer après coup.
//
// Édition / suppression d'une dépense : sur desktop, un simple clic ouvre
// `ExpenseActionSheet` (éditer / supprimer), avec un survol qui assombrit la
// ligne pour signaler qu'elle est cliquable — rester appuyé n'a pas de sens à
// la souris. Sur tactile, l'ancien geste d'appui long reste nécessaire (pas de
// hover) : la ligne change légèrement de couleur dès le début de l'appui, puis
// s'ouvre après le délai. Les deux modes sont distingués via `pointerType`
// (`PointerEvent`). La suppression est DIFFÉRÉE : l'appel serveur n'est
// déclenché qu'après 3 s via `UndoToast` — « annuler » l'annule sans jamais
// toucher la base.
//
// Surlignage survol/appui : PAS un fond par cellule. Une ligne est plusieurs
// items de grille distincts (pas de conteneur commun, cf. plus bas) séparés
// par le columnGap/rowGap partagé — un fond posé sur chaque cellule laisse le
// gap non peint entre elles (essayé, résultat visuellement décalé/en
// pointillés, cf. historique). À la place : un unique rectangle positionné en
// absolu, mesuré (bounding box des cellules pressables de la ligne active) et
// posé DERRIÈRE le contenu (`zIndex:-1`) — indépendant de la grille, donc
// aucun effet de bord sur l'alignement des colonnes partagées.
//
// Suppression en DEUX temps pour rester visible (pas de disparition abrupte) :
// 1) la ligne visée s'efface sur place (opacity/scale, ~260ms) tout en
//    occupant encore sa cellule de grille ;
// 2) une fois effacée, elle est réellement retirée de la grille partagée — les
//    lignes suivantes se décalent alors. Comme la grille est partagée (pas un
//    conteneur par ligne, cf. plus haut), CSS seul ne peut pas animer ce
//    décalage : un FLIP minimal (mesurer avant/après, appliquer un transform
//    inverse puis l'annuler avec transition) rejoue le glissement des cellules
//    survivantes vers leur nouvelle position, à chaque changement de la liste.
//    Même logique pour un « annuler » (la ligne réapparaît, les autres
//    glissent pour lui refaire de la place) — le FLIP est symétrique.

import { Fragment, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Expense } from "@app/domain-expense";
import { formatAmountEUR } from "@app/shared";
import { deleteExpenseAction } from "../../actions";
import { memberDisplayName, type MemberShare } from "../../../lib/household";
import { categoryLabelOf } from "./categories";
import { dayLabel, monthLabel } from "./date-label";
import { groupByDay, groupByMonth } from "./group-expenses";
import { AidSection } from "./aid-section";
import { ExpenseActionSheet } from "./expense-action-sheet";
import { ExpenseEditForm } from "./expense-edit-form";
import { CategoryChip, AmountDisplay } from "../design-system/balance";
import { UndoToast } from "../design-system/feedback";
import { WaterSeparator } from "../design-system/navigation";
import { Stack } from "../design-system/layout";

type Props = {
  expenses: Expense[];
  members: MemberShare[];
  currentMemberId: string;
  groupBy?: "day" | "month";
  showLabel?: boolean;
};

// Seuil de déplacement (px) au-delà duquel l'appui est requalifié en scroll et
// le minuteur d'appui long annulé. Durée du maintien avant mise en avant.
const LONG_PRESS_MOVE_PX = 10;
const LONG_PRESS_MS = 450;

// Durée de l'effacement sur place d'une ligne supprimée, avant son retrait
// effectif de la grille (phase 1 de la suppression en deux temps ci-dessus).
const EXIT_MS = 260;

// Index fixes des cellules suivies par ligne (pour le FLIP) : l'ensemble des
// cellules présentes pour une dépense donnée est déterministe (dépend de
// `showLabel`/`source`/`category`/`settlementId`, jamais mutées en dehors d'un
// rechargement complet des données) — les index restent donc stables d'un
// rendu à l'autre pour une même dépense.
const CELL_LABEL = 0;
const CELL_CATEGORY = 1;
const CELL_PAYER = 2;
const CELL_AMOUNT = 3;
const CELL_BADGE = 4;
const CELL_AID = 5;

// Cellules qui composent réellement la zone cliquable (survol/appui) : le
// badge récurrent et la section aide sont mesurés pour le FLIP mais exclus ici
// — les inclure gonflerait le rectangle de surlignage jusqu'à couvrir des
// contrôles qui ouvrent autre chose (ex. la disclosure d'AidSection).
const PRESSABLE_CELL_INDICES = [CELL_LABEL, CELL_CATEGORY, CELL_PAYER, CELL_AMOUNT];

// Débord esthétique autour du rectangle mesuré (respiration visuelle).
const HIGHLIGHT_PADDING_PX = 8;

export function MovementsList({
  expenses,
  members,
  currentMemberId,
  groupBy = "day",
  showLabel = false,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<Expense | null>(null);
  // Ligne en cours d'effacement sur place (phase 1) — distincte de `goneIds`
  // (phase 2, retrait effectif de la grille).
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [goneIds, setGoneIds] = useState<Set<string>>(new Set());

  // Retour visuel desktop (survol) et tactile (début d'appui) — cf. commentaire
  // d'en-tête : deux signaux distincts pilotés par `pointerType`, combinés en un
  // unique rectangle de surlignage (`highlightBox`) mesuré ci-dessous.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pressingId, setPressingId] = useState<string | null>(null);
  const lastPointerType = useRef<string | null>(null);

  // Ancre de positionnement (`position:relative`) pour le rectangle de
  // surlignage, posé en `position:absolute` à l'intérieur.
  const listRef = useRef<HTMLDivElement>(null);
  const [highlightBox, setHighlightBox] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  // État transitoire de l'appui tactile en cours (hors rendu : ne doit pas re-render).
  const press = useRef<{ timer: number; startX: number; startY: number } | null>(null);
  const exitTimer = useRef<number | null>(null);

  // Cellules DOM par dépense (pour le FLIP) et leurs rects au rendu précédent.
  const cellRefsById = useRef(new Map<string, (HTMLElement | undefined)[]>());
  const prevRectsById = useRef(new Map<string, (DOMRect | undefined)[]>());

  function cellRef(id: string, index: number) {
    return (el: HTMLElement | null) => {
      const cells = cellRefsById.current.get(id) ?? [];
      cells[index] = el ?? undefined;
      cellRefsById.current.set(id, cells);
    };
  }

  // FLIP minimal : après chaque changement de la liste affichée, compare la
  // position de chaque cellule survivante à celle mesurée au rendu précédent
  // et rejoue le déplacement (transform inverse → transition vers 0) plutôt
  // que de laisser le saut de layout se produire instantanément.
  useLayoutEffect(() => {
    const newRects = new Map<string, (DOMRect | undefined)[]>();
    cellRefsById.current.forEach((cells, id) => {
      const rects = cells.map((el) => (el?.isConnected ? el.getBoundingClientRect() : undefined));
      newRects.set(id, rects);
      const prevRects = prevRectsById.current.get(id);
      if (!prevRects) return;
      cells.forEach((el, i) => {
        if (!el) return;
        const prev = prevRects[i];
        const curr = rects[i];
        if (!prev || !curr) return;
        const dx = prev.left - curr.left;
        const dy = prev.top - curr.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
        el.style.transition = "none";
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        void el.offsetHeight; // force le recalcul avant de relâcher vers la position finale
        requestAnimationFrame(() => {
          el.style.transition = "transform var(--motion-settle-duration) var(--motion-settle-easing)";
          el.style.transform = "";
        });
      });
    });
    prevRectsById.current = newRects;
  }, [expenses, goneIds]);

  // Mesure le rectangle de surlignage d'une ligne, en coordonnées relatives à
  // `listRef` (donc suit naturellement le scroll de la page, contrairement à
  // un `position:fixed`). Appelé directement dans les handlers de survol/appui
  // (pas via un effet dérivé) : les refs des cellules sont déjà à jour au
  // moment du clic/survol, pas besoin d'attendre un re-render pour mesurer.
  function measureHighlightBox(id: string) {
    const container = listRef.current;
    const cells = cellRefsById.current.get(id);
    if (!container || !cells) return null;
    let top = Infinity;
    let left = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    let found = false;
    for (const i of PRESSABLE_CELL_INDICES) {
      const el = cells[i];
      if (!el?.isConnected) continue;
      const r = el.getBoundingClientRect();
      found = true;
      top = Math.min(top, r.top);
      left = Math.min(left, r.left);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    }
    if (!found) return null;
    const base = container.getBoundingClientRect();
    return {
      top: top - base.top - HIGHLIGHT_PADDING_PX,
      left: left - base.left - HIGHLIGHT_PADDING_PX,
      width: right - left + HIGHLIGHT_PADDING_PX * 2,
      height: bottom - top + HIGHLIGHT_PADDING_PX * 2,
    };
  }

  // Nettoyage des refs (pas du state — une dépense retirée de `expenses` après
  // `router.refresh()` reste inoffensive dans `goneIds`, elle ne correspond
  // plus jamais à rien dans `group.items`) : évite d'accumuler des noeuds DOM
  // détachés dans les maps de suivi FLIP.
  useEffect(() => {
    const ids = new Set(expenses.map((e) => e.id));
    cellRefsById.current.forEach((_, id) => {
      if (!ids.has(id)) cellRefsById.current.delete(id);
    });
    prevRectsById.current.forEach((_, id) => {
      if (!ids.has(id)) prevRectsById.current.delete(id);
    });
  }, [expenses]);

  function cancelPress() {
    if (press.current) {
      clearTimeout(press.current.timer);
      press.current = null;
    }
    setPressingId(null);
    setHighlightBox(null);
  }

  // Seules les dépenses manuelles non verrouillées réagissent au geste (décision
  // produit) : les occurrences récurrentes et les dépenses régularisées restent
  // inertes, exactement comme avant l'ajout de cette fonctionnalité.
  const isPressable = (e: Expense) => e.settlementId === null && e.source !== "recurring";

  function pressProps(e: Expense) {
    if (!isPressable(e)) return {};
    return {
      onPointerDown: (ev: React.PointerEvent) => {
        cancelPress();
        lastPointerType.current = ev.pointerType;
        if (ev.pointerType === "mouse") {
          // Desktop : un simple clic suffit (`onClick` ci-dessous), pas d'attente
          // — rester appuyé n'a pas de sens à la souris.
          return;
        }
        setPressingId(e.id);
        setHighlightBox(measureHighlightBox(e.id));
        press.current = {
          startX: ev.clientX,
          startY: ev.clientY,
          timer: window.setTimeout(() => {
            navigator.vibrate?.(10);
            setActiveId(e.id);
            setPressingId(null);
            setHighlightBox(null);
            press.current = null;
          }, LONG_PRESS_MS),
        };
      },
      onPointerMove: (ev: React.PointerEvent) => {
        const s = press.current;
        if (!s) return;
        if (
          Math.abs(ev.clientX - s.startX) > LONG_PRESS_MOVE_PX ||
          Math.abs(ev.clientY - s.startY) > LONG_PRESS_MOVE_PX
        ) {
          cancelPress();
        }
      },
      onPointerUp: cancelPress,
      onPointerCancel: cancelPress,
      onPointerEnter: (ev: React.PointerEvent) => {
        if (ev.pointerType === "mouse") {
          setHoveredId(e.id);
          setHighlightBox(measureHighlightBox(e.id));
        }
      },
      onPointerLeave: () => {
        cancelPress();
        setHoveredId((h) => (h === e.id ? null : h));
      },
      onClick: () => {
        // Le tactile ouvre déjà via le minuteur d'appui long ci-dessus ; un tap
        // court y déclenche aussi un `click` de courtoisie du navigateur, ignoré
        // ici (seul le clic souris doit ouvrir directement).
        if (lastPointerType.current === "mouse") {
          setHoveredId(null);
          setHighlightBox(null);
          setActiveId(e.id);
        }
      },
      // touch-action pan-y : le scroll vertical reste natif (et déclenche un
      // pointercancel qui annule le maintien) ; on n'intercepte que l'appui long.
      style: { cursor: "pointer", touchAction: "pan-y" as const },
    };
  }

  // Suppression réelle (soft delete côté serveur) puis resync du Server Component.
  // En cas d'échec (ex. dépense supprimée entre-temps), le refresh la fait
  // réapparaître — l'optimisme est ainsi corrigé sans état d'erreur dédié.
  function commitDeletion(expenseId: string) {
    startTransition(async () => {
      await deleteExpenseAction({ expenseId });
      router.refresh();
    });
  }

  function armDeletion(expense: Expense) {
    // Un seul toast à la fois : si une suppression est déjà en attente, on la
    // valide immédiatement avant d'armer la nouvelle (aucune perte silencieuse).
    if (pendingDeletion && pendingDeletion.id !== expense.id) {
      commitDeletion(pendingDeletion.id);
      setGoneIds((prev) => new Set(prev).add(pendingDeletion.id));
    }
    if (exitTimer.current) {
      clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }
    setActiveId(null);
    setPendingDeletion(expense);
    setExitingId(expense.id);
    exitTimer.current = window.setTimeout(() => {
      setGoneIds((prev) => new Set(prev).add(expense.id));
      setExitingId(null);
      exitTimer.current = null;
    }, EXIT_MS);
  }

  const groups = groupBy === "month" ? groupByMonth(expenses) : groupByDay(expenses);
  const labelOf = groupBy === "month" ? monthLabel : dayLabel;

  // Retrait effectif de la grille (phase 2, une fois l'effacement joué).
  const isHidden = (e: Expense) => goneIds.has(e.id);

  // Effacement sur place (phase 1) : la ligne occupe encore sa place, mais
  // s'estompe — pointer-events coupés pour éviter une interaction fantôme.
  function exitStyle(id: string): React.CSSProperties {
    if (exitingId !== id) return {};
    return {
      opacity: 0,
      transform: "scale(0.97)",
      pointerEvents: "none",
      transition: `opacity ${EXIT_MS}ms var(--motion-micro-easing), transform ${EXIT_MS}ms var(--motion-micro-easing)`,
    };
  }

  const activeExpense = expenses.find((e) => e.id === activeId) ?? null;
  const editingExpense = expenses.find((e) => e.id === editingId) ?? null;

  return (
    <div ref={listRef} style={{ position: "relative" }}>
      {highlightBox ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: highlightBox.top,
            left: highlightBox.left,
            width: highlightBox.width,
            height: highlightBox.height,
            background: "var(--surface-raised)",
            borderRadius: "var(--radius-subtle)",
            zIndex: -1,
            pointerEvents: "none",
          }}
        />
      ) : null}
      <Stack gap={3}>
      {groups.map((group) => {
        const visible = group.items.filter((e) => !isHidden(e));
        if (visible.length === 0) return null;
        return (
          <Stack gap={2} key={group.key}>
            <WaterSeparator label={labelOf(group.key)} />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                alignItems: "center",
                rowGap: "var(--space-2)",
                columnGap: "var(--space-2)",
              }}
            >
              {visible.map((e) => {
                const p = pressProps(e);
                const exit = exitStyle(e.id);
                return (
                  <Fragment key={e.id}>
                    {showLabel ? (
                      <span
                        ref={cellRef(e.id, CELL_LABEL)}
                        {...p}
                        style={{ gridColumn: "1 / -1", fontWeight: 500, ...p.style, ...exit }}
                      >
                        {e.label}
                      </span>
                    ) : null}
                    <div
                      ref={cellRef(e.id, CELL_CATEGORY)}
                      {...p}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-1)",
                        ...p.style,
                        ...exit,
                      }}
                    >
                      <CategoryChip name={categoryLabelOf(e.category)} size={28} />
                      <span>{categoryLabelOf(e.category).toLowerCase()}</span>
                    </div>
                    <span
                      ref={cellRef(e.id, CELL_PAYER)}
                      {...p}
                      style={{ color: "var(--text-secondary)", ...p.style, ...exit }}
                    >
                      {memberDisplayName(members, e.payerId)}
                    </span>
                    <span
                      ref={cellRef(e.id, CELL_AMOUNT)}
                      {...p}
                      style={{ justifySelf: "end", ...p.style, ...exit }}
                    >
                      <AmountDisplay value={formatAmountEUR(e.grossCents)} size="sm" />
                    </span>
                    {e.source === "recurring" ? (
                      <span
                        ref={cellRef(e.id, CELL_BADGE)}
                        style={{
                          gridColumn: "1 / -1",
                          color: "var(--text-secondary)",
                          fontSize: "var(--text-sm)",
                          ...exit,
                        }}
                      >
                        dépense qui revient chaque mois
                      </span>
                    ) : null}
                    {e.category === "loyer" && e.settlementId === null ? (
                      <div ref={cellRef(e.id, CELL_AID)} style={{ gridColumn: "1 / -1", ...exit }}>
                        <AidSection
                          expenseId={e.id}
                          grossCents={e.grossCents}
                          category={e.category}
                          currentMemberId={currentMemberId}
                          members={members}
                          initialAids={e.aids}
                          onSharesUpdated={() => router.refresh()}
                        />
                      </div>
                    ) : null}
                  </Fragment>
                );
              })}
            </div>
          </Stack>
        );
      })}

      {activeExpense ? (
        <ExpenseActionSheet
          expense={activeExpense}
          members={members}
          onEdit={() => {
            setEditingId(activeExpense.id);
            setActiveId(null);
          }}
          onDelete={() => armDeletion(activeExpense)}
          onClose={() => setActiveId(null)}
        />
      ) : null}

      {editingExpense ? (
        <ExpenseEditForm
          expense={editingExpense}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            router.refresh();
          }}
        />
      ) : null}

      {pendingDeletion ? (
        <UndoToast
          key={pendingDeletion.id}
          message="dépense supprimée"
          onUndo={() => {
            if (exitTimer.current) {
              clearTimeout(exitTimer.current);
              exitTimer.current = null;
            }
            setExitingId(null);
            setGoneIds((prev) => {
              if (!prev.has(pendingDeletion.id)) return prev;
              const next = new Set(prev);
              next.delete(pendingDeletion.id);
              return next;
            });
            setPendingDeletion(null);
          }}
          onDismiss={() => {
            commitDeletion(pendingDeletion.id);
            setPendingDeletion(null);
          }}
        />
      ) : null}
      </Stack>
    </div>
  );
}
