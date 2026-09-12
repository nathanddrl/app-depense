// Géométrie + easing du Donut — extrait de Donut.tsx pour être testable sans
// rendu React (environnement Vitest "node"), même principe que
// water-line-geometry.ts. Aucune connaissance du domaine ici (le composant
// est agnostique — spec refonte solde) : que des angles, des chemins SVG, une
// fonction d'accélération.

export type Slice = { id: string; startAngle: number; endAngle: number };

const FULL_CIRCLE = 360;
const START_ANGLE = -90; // 12h, comme un cadran — le donut se lit dans le sens horaire.

/**
 * Largeur angulaire minimale d'une part non nulle (spec refonte solde : « une
 * part de très faible valeur, moins de 2 % du total » reste visible/tapable).
 * Choix documenté (compte-rendu) : largeur minimale plutôt que regroupement —
 * un regroupement briserait l'invariant « chaque part reste navigable » au
 * niveau 2 (vers quelle catégorie une part « autres » descendrait-elle ?).
 */
export const MIN_SLICE_FRACTION = 0.02;

/**
 * Angles de chaque part, proportionnels à `value`, avec plancher minimal
 * (2 %) : les parts sous ce plancher sont remontées à `MIN_SLICE_FRACTION`,
 * l'excédent est repris proportionnellement sur les parts au-dessus. Départ à
 * 12h, sens horaire. `values` peut contenir des 0 (ex. un membre sans
 * dépense sur la période, niveau 1) — la part reste visible au plancher.
 */
export function computeSliceAngles(values: { id: string; valueCents: number }[]): Slice[] {
  const total = values.reduce((s, v) => s + v.valueCents, 0);
  if (total <= 0 || values.length === 0) {
    // Défensif — l'appelant doit afficher un état vide plutôt qu'un donut à
    // total nul, mais on ne divise jamais par 0 ici.
    const equalFraction = values.length > 0 ? 1 / values.length : 0;
    return buildAnglesFromFractions(values.map((v) => ({ id: v.id, fraction: equalFraction })));
  }

  const rawFractions = values.map((v) => ({ id: v.id, fraction: v.valueCents / total }));
  const flooredIds = new Set(
    rawFractions.filter((f) => f.fraction < MIN_SLICE_FRACTION).map((f) => f.id),
  );

  if (flooredIds.size === 0) return buildAnglesFromFractions(rawFractions);

  const flooredTotal = flooredIds.size * MIN_SLICE_FRACTION;
  const remaining = Math.max(0, 1 - flooredTotal);
  const sumOfRest = rawFractions
    .filter((f) => !flooredIds.has(f.id))
    .reduce((s, f) => s + f.fraction, 0);
  const scale = sumOfRest > 0 ? remaining / sumOfRest : 0;

  const adjusted = rawFractions.map((f) => ({
    id: f.id,
    fraction: flooredIds.has(f.id) ? MIN_SLICE_FRACTION : f.fraction * scale,
  }));

  return buildAnglesFromFractions(adjusted);
}

function buildAnglesFromFractions(fractions: { id: string; fraction: number }[]): Slice[] {
  let cursor = START_ANGLE;
  return fractions.map(({ id, fraction }) => {
    const startAngle = cursor;
    const endAngle = cursor + fraction * FULL_CIRCLE;
    cursor = endAngle;
    return { id, startAngle, endAngle };
  });
}

export function sliceMidAngle(slice: { startAngle: number; endAngle: number }): number {
  return (slice.startAngle + slice.endAngle) / 2;
}

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function pointOnRing(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number,
): { x: number; y: number } {
  return polarToCartesian(cx, cy, radius, angleDeg);
}

/**
 * Rotation (degrés) d'un libellé posé sur la couronne, pour qu'un texte
 * horizontal suive la TANGENTE du cercle à cet angle plutôt que de rester à
 * plat : sans ça, un texte proche de 9h/3h (où le cercle est tangent à une
 * ligne horizontale) déborde du donut par la gauche/la droite. Aligné sur la
 * tangente, le texte reste dans l'épaisseur de la couronne à n'importe quel
 * angle — vertical à 3h/9h, horizontal à 12h/6h. `+180°` si la rotation
 * tangente rendrait le texte tête en bas (jamais un libellé à l'envers).
 */
export function labelRotation(angleDeg: number): number {
  const normalize = (deg: number) => ((deg % 360) + 360) % 360;
  let rotation = normalize(angleDeg + 90);
  if (rotation > 90 && rotation < 270) rotation = normalize(rotation + 180);
  return rotation;
}

/**
 * Chemin SVG d'un secteur de couronne (donut) entre deux angles. Gère le cas
 * limite d'une part unique couvrant tout le cercle (360°, ex. un seul membre
 * a payé sur la période) : les flags d'arc SVG ne bouclent pas sur un sweep
 * de 360° exact, l'angle de fin est donc infinitésimalement raccourci.
 */
export function annularSectorPath(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = endAngle - startAngle;
  const clampedEnd = sweep >= FULL_CIRCLE - 1e-3 ? startAngle + FULL_CIRCLE - 1e-3 : endAngle;
  const largeArc = clampedEnd - startAngle > 180 ? 1 : 0;

  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, clampedEnd);
  const innerStart = polarToCartesian(cx, cy, innerRadius, clampedEnd);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, startAngle);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
    "Z",
  ].join(" ");
}

/**
 * Interpolation cubic-bezier, même algorithme que le moteur CSS (UnitBezier,
 * WebKit) — la géométrie du donut est animée en JS (l'attribut `d` d'un path
 * n'est pas animable en CSS) mais doit suivre EXACTEMENT la même courbe que
 * --motion-settle-easing pour rester cohérente avec le reste de l'app.
 * P0=(0,0) et P3=(1,1) implicites (comme la syntaxe CSS `cubic-bezier`).
 */
export function cubicBezierEase(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  function sampleX(t: number): number {
    return ((ax * t + bx) * t + cx) * t;
  }
  function sampleY(t: number): number {
    return ((ay * t + by) * t + cy) * t;
  }
  function sampleDerivativeX(t: number): number {
    return (3 * ax * t + 2 * bx) * t + cx;
  }

  function solveCurveX(x: number): number {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-6) return t;
      const derivative = sampleDerivativeX(t);
      if (Math.abs(derivative) < 1e-6) break;
      t -= dx / derivative;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    while (hi - lo > 1e-6) {
      const current = sampleX(t);
      if (Math.abs(current - x) < 1e-6) return t;
      if (x > current) lo = t;
      else hi = t;
      t = (hi + lo) / 2;
    }
    return t;
  }

  return function ease(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return sampleY(solveCurveX(t));
  };
}
