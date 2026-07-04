import type { SharePct, AidInput, Share, EffectiveAid, CalcWarning, MemberId } from "./types";
import { CalcPreconditionError } from "./types";
import { computeShares, distributeFloorRemainder } from "./shares";

export interface ExpenseInput {
  grossCents: number;
  payerId: MemberId;
  ratio: SharePct[];
  aids?: AidInput[];
}

export interface ComputedExpense {
  netCents: number;
  shares: Share[];
  effectiveAids: EffectiveAid[];
  warnings: CalcWarning[];
}

/** Agrège les aides par bénéficiaire, en préservant l'ordre de première apparition. */
function aggregateAids(aids: AidInput[]): { beneficiaryId: MemberId; amountCents: number }[] {
  const order: MemberId[] = [];
  const totals = new Map<MemberId, number>();
  for (const a of aids) {
    if (!Number.isInteger(a.amountCents) || a.amountCents <= 0) {
      throw new CalcPreconditionError(
        `montant d'aide doit être un entier > 0 (reçu ${a.amountCents}).`,
      );
    }
    if (!totals.has(a.beneficiaryId)) order.push(a.beneficiaryId);
    totals.set(a.beneficiaryId, (totals.get(a.beneficiaryId) ?? 0) + a.amountCents);
  }
  return order.map((id) => ({ beneficiaryId: id, amountCents: totals.get(id) as number }));
}

/**
 * Exécute le pipeline canonique d'une dépense (spec 4.1) :
 *   net = max(0, brut − Σ aides) → répartition selon ratio (4.3).
 * Gère le cas aide > charge (4.4 / D11) : net plafonné à 0, plafond `brut` réparti
 * PAR BÉNÉFICIAIRE (reliquat au payeur), toutes parts à 0, warning AID_EXCEEDS_CHARGE.
 *
 * Précondition (défense en profondeur, ch.7 valide en amont) : `grossCents` entier > 0,
 * chaque aide entière > 0. Le ratio est validé par `computeShares`.
 */
export function computeExpense(input: ExpenseInput): ComputedExpense {
  const { grossCents, payerId, ratio } = input;
  if (!Number.isInteger(grossCents) || grossCents <= 0) {
    throw new CalcPreconditionError(`grossCents doit être un entier > 0 (reçu ${grossCents}).`);
  }

  const aggregated = aggregateAids(input.aids ?? []);
  const totalAid = aggregated.reduce((s, a) => s + a.amountCents, 0);

  // Cas aide > charge (4.4) : plafond, parts nulles, warning.
  if (totalAid > grossCents) {
    // Le ratio est tout de même validé (cohérence des préconditions).
    const zeroShares = computeShares(0, ratio, payerId);
    const capped = distributeFloorRemainder(
      grossCents,
      aggregated.map((a) => ({ id: a.beneficiaryId, weight: a.amountCents })),
      totalAid,
      payerId,
    );
    return {
      netCents: 0,
      shares: zeroShares,
      effectiveAids: capped.map((c) => ({
        beneficiaryId: c.id,
        effectiveCents: c.cents,
      })),
      warnings: ["AID_EXCEEDS_CHARGE"],
    };
  }

  // Régime normal (y compris Σ aides == brut → net 0 sans warning).
  const netCents = grossCents - totalAid;
  return {
    netCents,
    shares: computeShares(netCents, ratio, payerId),
    effectiveAids: aggregated.map((a) => ({
      beneficiaryId: a.beneficiaryId,
      effectiveCents: a.amountCents,
    })),
    warnings: [],
  };
}
