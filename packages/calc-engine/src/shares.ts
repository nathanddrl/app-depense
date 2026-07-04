import type { SharePct, Share, MemberId } from "./types";
import { CalcPreconditionError } from "./types";

/**
 * Primitive d'arrondi unique du moteur (spec 4.3 / D5) : distribue `total`
 * centimes selon des poids ENTIERS, `floor` par entité, et attribue le reliquat
 * entier au payeur. Déterministe, `Σ = total` exact.
 *
 * - `base(i) = floor(total × weight(i) / totalWeight)` — arithmétique entière
 *   exacte (poids entiers), jamais de flottant sur l'argent.
 * - `reliquat = total − Σ base` ∈ [0, nbEntités[ → ajouté à la part du payeur.
 * - Si le payeur n'est pas dans `entries`, une entrée lui est créée (= reliquat).
 *   C'est ce qui fait tenir l'invariant en 4.4 quand le payeur n'a perçu aucune aide.
 *
 * Réutilisée par `computeShares` (poids = centièmes de %) et le plafond d'aide
 * en 4.4 (poids = centimes d'aide) — la règle d'arrondi n'existe qu'ici.
 */
export function distributeFloorRemainder(
  total: number,
  entries: { id: MemberId; weight: number }[],
  totalWeight: number,
  payerId: MemberId,
): { id: MemberId; cents: number }[] {
  const result = entries.map((e) => ({
    id: e.id,
    cents: totalWeight === 0 ? 0 : Math.floor((total * e.weight) / totalWeight),
  }));
  const remainder = total - result.reduce((s, r) => s + r.cents, 0);
  const payerEntry = result.find((r) => r.id === payerId);
  if (payerEntry) {
    payerEntry.cents += remainder;
  } else {
    result.push({ id: payerId, cents: remainder });
  }
  return result;
}

/**
 * Répartit une charge nette entre les membres selon un ratio en % (spec 4.3).
 * Le reliquat d'arrondi est absorbé par le payeur (D5). `Σ part = netCents` exact.
 *
 * Précondition (défense en profondeur, ch.7 valide en amont) : `netCents` entier
 * ≥ 0, ratio non vide, chaque `pct ≥ 0`, `Σ pct = 100`, payeur présent dans le ratio.
 */
export function computeShares(netCents: number, ratio: SharePct[], payerId: MemberId): Share[] {
  if (!Number.isInteger(netCents) || netCents < 0) {
    throw new CalcPreconditionError(`netCents doit être un entier ≥ 0 (reçu ${netCents}).`);
  }
  if (ratio.length === 0) {
    throw new CalcPreconditionError("ratio vide.");
  }
  // % → centièmes entiers (précision numeric(5,2)) pour une somme exacte.
  const hundredths = ratio.map((r) => {
    if (!(r.pct >= 0)) {
      throw new CalcPreconditionError(`pct négatif ou invalide (${r.pct}).`);
    }
    return Math.round(r.pct * 100);
  });
  const totalHundredths = hundredths.reduce((s, h) => s + h, 0);
  if (totalHundredths !== 10000) {
    throw new CalcPreconditionError(`Σ pct doit valoir 100 (reçu ${totalHundredths / 100}).`);
  }
  if (!ratio.some((r) => r.memberId === payerId)) {
    throw new CalcPreconditionError(`le payeur ${payerId} doit figurer dans le ratio.`);
  }

  const distributed = distributeFloorRemainder(
    netCents,
    ratio.map((r, i) => ({ id: r.memberId, weight: hundredths[i] })),
    10000,
    payerId,
  );
  const centsById = new Map(distributed.map((d) => [d.id, d.cents]));
  return ratio.map((r) => ({
    memberId: r.memberId,
    cents: centsById.get(r.memberId) ?? 0,
    pctSnapshot: r.pct,
  }));
}
