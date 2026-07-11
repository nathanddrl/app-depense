// Géométrie + couleur de WaterLine, dérivées de la même paire (abs, signe) —
// jamais deux calculs séparés qui pourraient diverger (règle la plus
// importante du composant). Extrait de WaterLine.tsx pour être testable sans
// rendu React (environnement Vitest "node", pas de DOM ici).
//
// Encodage directionnel (v2) : la géométrie (profondeur, seuils) ne change
// pas selon le signe, seule la couleur bascule entre l'échelle négative et
// l'échelle positive — mêmes seuils 0.25/0.6 pour les deux.

export type WaterLineGeometry = {
  path: string;
  colorVar: string;
  depth: number;
};

const COLOR_SUBTLE_THRESHOLD = 0.25;
const COLOR_MODERATE_THRESHOLD = 0.6;

function balanceColorVar(abs: number, sign: 1 | -1): string {
  if (abs === 0) return "var(--color-balance-none)";
  const direction = sign < 0 ? "negative" : "positive";
  if (abs < COLOR_SUBTLE_THRESHOLD) return `var(--color-balance-${direction}-subtle)`;
  if (abs < COLOR_MODERATE_THRESHOLD) return `var(--color-balance-${direction}-moderate)`;
  return `var(--color-balance-${direction}-ceiling)`;
}

export function computeWaterLine(
  magnitude: number,
  width: number,
  height: number,
): WaterLineGeometry {
  const abs = Math.min(Math.abs(magnitude), 1);
  const depth = abs * (height * 0.28);
  const midY = height / 2;
  const sign = magnitude < 0 ? -1 : 1;
  const cx = width / 2;

  const colorVar = balanceColorVar(abs, sign);
  const path = `M 0 ${midY} Q ${cx} ${midY + sign * depth} ${width} ${midY}`;

  return { path, colorVar, depth };
}
