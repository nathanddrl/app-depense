import type { AidInput, MemberId, SharePct } from "./types";
import { CalcPreconditionError } from "./types";
import { computeShares, distributeFloorRemainder } from "./shares";
import { computeExpense } from "./expense";

/** Une aide, avec son libellé, pour la décomposition « en deux temps » (spec 8.3). */
export type LabelledAidInput = AidInput & { label: string };

/**
 * Ligne d'ajustement « aide » de la décomposition (spec 8.3, 2e temps). `sharedCents`
 * est le montant que le bénéficiaire de l'aide et l'autre membre se répartissent
 * (au prorata du ratio) : à « rendre » si le bénéficiaire est le payeur, à « devoir
 * en plus » si le bénéficiaire est l'autre membre.
 */
export interface AidBreakdownLine {
  label: string;
  beneficiaryId: MemberId;
  aidCents: number;
  sharedCents: number;
}

/**
 * Décomposition d'UNE dépense pour un foyer à deux membres (spec 8.3). `otherId`
 * doit à `payerId` (verbe « doit ») : `baseOwedCents` (1er temps, sur le brut,
 * ratio seul) puis chaque `aidLines[i]` ajuste ce montant (2e temps).
 * `totalOwedCents` peut être négatif : le sens s'inverse alors (payerId doit à
 * otherId).
 */
export interface ExpenseBreakdown {
  payerId: MemberId;
  otherId: MemberId;
  baseOwedCents: number;
  aidLines: AidBreakdownLine[];
  totalOwedCents: number;
}

/**
 * Décompose une dépense en « deux temps » (spec 8.3) pour un foyer à deux
 * membres : 1) répartition du brut selon le ratio (comme s'il n'y avait aucune
 * aide) ; 2) pour chaque aide, la part de son bénéficiaire réel réajuste ce
 * montant. Le total obtenu est identique à `computeBalance` restreint à cette
 * seule dépense — c'est une reformulation pédagogique du même calcul, pas un
 * second calcul (DA4).
 *
 * Précondition : `ratio` doit couvrir EXACTEMENT les deux membres du foyer (le
 * produit ne gère que des foyers à deux, cf. `reduceBalanceTwoMembers`).
 */
export function computeExpenseBreakdown(input: {
  grossCents: number;
  payerId: MemberId;
  ratio: SharePct[];
  aids: LabelledAidInput[];
}): ExpenseBreakdown {
  const { grossCents, payerId, ratio, aids } = input;
  if (ratio.length !== 2) {
    throw new CalcPreconditionError(
      `la décomposition ne gère qu'un foyer à deux membres (reçu ${ratio.length}).`,
    );
  }
  const otherEntry = ratio.find((r) => r.memberId !== payerId);
  if (!otherEntry) {
    throw new CalcPreconditionError(`le payeur ${payerId} doit figurer dans le ratio.`);
  }
  const otherId = otherEntry.memberId;
  const otherHundredths = Math.round(otherEntry.pct * 100);

  // 1er temps : répartition du brut seul (le moteur canonique, sans aide).
  const baseShares = computeShares(grossCents, ratio, payerId);
  const baseOwedCents = baseShares.find((s) => s.memberId === otherId)?.cents ?? 0;

  // Aides effectives (post-plafond 4.4), pour construire le 2e temps.
  const { effectiveAids } = computeExpense({ grossCents, payerId, ratio, aids });

  const aidLines: AidBreakdownLine[] = effectiveAids.map((effective) => {
    const label = aids.find((a) => a.beneficiaryId === effective.beneficiaryId)?.label ?? "";
    // Part de l'autre membre dans l'aide, au même prorata que le ratio de charge.
    const [otherShare] = distributeFloorRemainder(
      effective.effectiveCents,
      [{ id: otherId, weight: otherHundredths }],
      10000,
      payerId,
    );
    const otherShareCents = otherShare?.id === otherId ? otherShare.cents : 0;
    const sharedCents =
      effective.beneficiaryId === payerId
        ? otherShareCents
        : effective.effectiveCents - otherShareCents;
    return {
      label,
      beneficiaryId: effective.beneficiaryId,
      aidCents: effective.effectiveCents,
      sharedCents,
    };
  });

  const totalOwedCents = aidLines.reduce(
    (sum, line) => sum + (line.beneficiaryId === payerId ? -line.sharedCents : line.sharedCents),
    baseOwedCents,
  );

  return { payerId, otherId, baseOwedCents, aidLines, totalOwedCents };
}
