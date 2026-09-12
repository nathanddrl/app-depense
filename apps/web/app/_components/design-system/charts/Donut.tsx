"use client";

// design-system/charts — Donut générique (refonte solde, écran « d'où vient
// l'écart »). Ne connaît rien du domaine (membre/catégorie/dépense/solde) :
// il reçoit des parts `{id,label,valueCents,color,onSelect?}` et un contenu
// central, il dessine et il anime. La composition (couleurs, libellés
// humains) vit dans balance-breakdown-*.tsx.
//
// Animation JS (l'attribut `d` d'un path SVG n'est pas animable en CSS) :
// interpolation angulaire par rAF, easing = EXACTEMENT --motion-settle-easing
// (cubicBezierEase, donut-geometry.ts) — zéro spring, zéro rebond. Recomposition
// continue entre deux jeux de parts (ex. niveau 1 → 2) : les ids absents de
// l'ancien/nouveau jeu convergent vers `transitionOrigin` plutôt que de
// disparaître/apparaître d'un coup — jamais de flash ni de remontage visible.
// `prefers-reduced-motion: reduce` bascule directement sur l'état cible.
//
// L'état animé (`rendered`) est un VRAI state React, calculé et posé
// uniquement depuis l'effet/la boucle rAF — jamais lu depuis une ref pendant
// le rendu (react-hooks/refs). Les refs ne servent qu'à faire persister,
// ENTRE deux effets, l'angle/les métadonnées courants d'une part.

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { formatAmountEUR } from "@app/shared";
import {
  computeSliceAngles,
  sliceMidAngle,
  annularSectorPath,
  pointOnRing,
  labelRotation,
  cubicBezierEase,
} from "./donut-geometry";
import styles from "./Donut.module.css";

export type DonutSlice = {
  id: string;
  label: string;
  valueCents: number;
  color: string;
  onSelect?: () => void;
};

type Angle = { start: number; end: number };
type Meta = { label: string; valueCents: number; color: string; onSelect?: () => void };
type AnimatedSlice = Meta & { id: string; startAngle: number; endAngle: number };

type Props = {
  slices: DonutSlice[];
  centerContent: ReactNode;
  /** Angle (degrés, 12h = -90, sens horaire) de convergence des parts
   * ajoutées/retirées lors d'un changement de niveau (cf. en-tête). */
  transitionOrigin?: number;
  size?: number;
};

const DURATION_MS = 600; // --motion-settle-duration
const EASE = cubicBezierEase(0.16, 1, 0.3, 1); // --motion-settle-easing
const LABEL_MIN_ANGLE_DEG = 24;
const PX_PER_CHAR = 6.2;

function reducedMotionPreferred(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function toAnimatedSlices(
  angles: Map<string, Angle>,
  metaById: Map<string, Meta>,
): AnimatedSlice[] {
  return [...angles.entries()].map(([id, angle]) => {
    const meta = metaById.get(id);
    return {
      id,
      label: meta?.label ?? "",
      valueCents: meta?.valueCents ?? 0,
      color: meta?.color ?? "var(--border-strong)",
      onSelect: meta?.onSelect,
      startAngle: angle.start,
      endAngle: angle.end,
    };
  });
}

export function Donut({ slices, centerContent, transitionOrigin = -90, size = 240 }: Props) {
  const metaRef = useRef(new Map<string, Meta>());
  const angleRef = useRef(new Map<string, Angle>());
  const rafRef = useRef<number | null>(null);
  const [rendered, setRendered] = useState<AnimatedSlice[]>([]);

  const signature = slices.map((s) => `${s.id}:${s.valueCents}`).join("|");

  useLayoutEffect(() => {
    for (const s of slices) {
      metaRef.current.set(s.id, {
        label: s.label,
        valueCents: s.valueCents,
        color: s.color,
        onSelect: s.onSelect,
      });
    }

    const toAngles = computeSliceAngles(
      slices.map((s) => ({ id: s.id, valueCents: s.valueCents })),
    );
    const toMap = new Map(
      toAngles.map((a): [string, Angle] => [a.id, { start: a.startAngle, end: a.endAngle }]),
    );
    const fromMap = new Map(angleRef.current);
    const unionIds = new Set([...fromMap.keys(), ...toMap.keys()]);

    const from = new Map<string, Angle>();
    const to = new Map<string, Angle>();
    for (const id of unionIds) {
      from.set(id, fromMap.get(id) ?? { start: transitionOrigin, end: transitionOrigin });
      to.set(id, toMap.get(id) ?? { start: transitionOrigin, end: transitionOrigin });
    }

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    function settle() {
      angleRef.current = toMap;
      for (const id of metaRef.current.keys()) {
        if (!toMap.has(id)) metaRef.current.delete(id);
      }
      setRendered(toAnimatedSlices(toMap, metaRef.current));
    }

    if (reducedMotionPreferred()) {
      settle();
      return;
    }

    const startTime = performance.now();
    function frame(now: number) {
      const t = Math.min(1, (now - startTime) / DURATION_MS);
      const eased = EASE(t);
      const merged = new Map<string, Angle>();
      for (const id of unionIds) {
        const f = from.get(id)!;
        const dest = to.get(id)!;
        merged.set(id, {
          start: f.start + (dest.start - f.start) * eased,
          end: f.end + (dest.end - f.end) * eased,
        });
      }
      angleRef.current = merged;
      setRendered(toAnimatedSlices(merged, metaRef.current));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        rafRef.current = null;
        settle();
      }
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // signature encode déjà (id, valueCents) de `slices` — ni `slices` (nouvelle
    // référence à chaque rendu parent) ni les callbacks `onSelect` ne doivent
    // redéclencher la transition, seule une VRAIE nouvelle composition compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, transitionOrigin]);

  useLayoutEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size / 2 - 4;
  const innerRadius = outerRadius * 0.55;
  const labelRadius = (outerRadius + innerRadius) / 2;

  return (
    <div className={styles.wrapper}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className={styles.svg}
        style={{ width: size, height: size }}
      >
        {rendered.map((slice) => {
          const width = Math.max(0, slice.endAngle - slice.startAngle);
          if (width <= 0) return null;
          const path = annularSectorPath(
            cx,
            cy,
            outerRadius,
            innerRadius,
            slice.startAngle,
            slice.endAngle,
          );
          const mid = sliceMidAngle(slice);
          const labelPoint = pointOnRing(cx, cy, labelRadius, mid);
          const arcLengthPx = ((width * Math.PI) / 180) * labelRadius;
          const maxChars = Math.floor(arcLengthPx / PX_PER_CHAR);
          const canShowLabel =
            width >= LABEL_MIN_ANGLE_DEG && maxChars >= 3 && slice.label.length > 0;
          const labelText =
            canShowLabel && slice.label.length > maxChars
              ? `${slice.label.slice(0, maxChars - 1)}…`
              : slice.label;

          return (
            <g key={slice.id}>
              <path
                d={path}
                fill={slice.color}
                className={slice.onSelect ? styles.interactive : styles.static}
                role={slice.onSelect ? "button" : undefined}
                tabIndex={slice.onSelect ? 0 : undefined}
                aria-label={
                  slice.onSelect
                    ? `${slice.label}, ${formatAmountEUR(slice.valueCents)}`
                    : undefined
                }
                aria-hidden={slice.onSelect ? undefined : true}
                onClick={slice.onSelect}
                onKeyDown={
                  slice.onSelect
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          slice.onSelect?.();
                        }
                      }
                    : undefined
                }
              />
              {canShowLabel ? (
                <text
                  x={labelPoint.x}
                  y={labelPoint.y}
                  transform={`rotate(${labelRotation(mid)} ${labelPoint.x} ${labelPoint.y})`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={styles.label}
                  aria-hidden="true"
                >
                  {labelText}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className={styles.center} style={{ width: size, height: size }}>
        {centerContent}
      </div>
      <ul className={styles.legend}>
        {slices.map((s) => (
          <li key={s.id} className={styles.legendItem}>
            <span className={styles.swatch} style={{ background: s.color }} aria-hidden="true" />
            <span>
              {s.label}, {formatAmountEUR(s.valueCents)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
