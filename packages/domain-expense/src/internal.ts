// @app/domain-expense — helpers internes partagés par create/update.
//
// Le domaine ORCHESTRE, il ne recalcule jamais : les parts figées sortent
// exclusivement de `calc-engine.computeExpense` (archi ch.1.4 / DA4).

import { computeExpense } from "@app/calc-engine";
import type { BalanceExpense } from "@app/calc-engine";
import type { AppError } from "@app/shared";
import type { StoredExpense } from "./repository";
import type { ExpenseShareDTO, ShareInput } from "./types";

/**
 * Parts figées d'une dépense via le moteur (spec 4.1/4.3). Sans aide dans ce
 * chantier → net = brut. Peut lever `CalcPreconditionError` (filet, ch.7 valide en
 * amont) : les appelants l'interceptent et la mappent en `VALIDATION_ERROR`.
 */
export function computeShareDTOs(
  grossCents: number,
  payerId: string,
  ratio: ShareInput[],
): ExpenseShareDTO[] {
  const computed = computeExpense({ grossCents, payerId, ratio });
  return computed.shares.map((s) => ({
    memberId: s.memberId,
    cents: s.cents,
    pctSnapshot: s.pctSnapshot,
  }));
}

/**
 * Validation CONTEXTUELLE (touche la DB, donc ici et pas dans shared) : le payeur
 * et chaque membre porteur d'une part appartiennent au foyer (ch.7).
 */
export function validateHouseholdMembers(
  memberIds: string[],
  payerId: string,
  shares: ShareInput[],
): AppError | null {
  const members = new Set(memberIds);
  if (!members.has(payerId)) {
    return {
      code: "VALIDATION_ERROR",
      message: "Le payeur doit être un membre du foyer.",
      field: "payerId",
    };
  }
  for (const s of shares) {
    if (!members.has(s.memberId)) {
      return {
        code: "VALIDATION_ERROR",
        message: "Une part vise une personne hors du foyer.",
        field: "shares",
      };
    }
  }
  return null;
}

/**
 * La dépense TELLE QU'ELLE ÉTAIT CONNUE à l'instant `at` (ex. confirmation
 * d'une régularisation) : absente si créée après ou déjà supprimée. Si elle a
 * été modifiée depuis, c'est l'état figé par la première révision postérieure
 * à `at` qui fait foi (montant, payeur, date, parts, aides) ; dans tous les
 * cas, les aides ajoutées après `at` sont écartées. Seule limite restante :
 * une modification antérieure à l'historisation (révisions absentes) est
 * rejouée avec la valeur actuelle.
 */
export function expenseKnownAt(expense: StoredExpense, at: string): StoredExpense | null {
  const instant = Date.parse(at);
  if (Date.parse(expense.createdAt) > instant) return null;
  if (expense.deletedAt !== null && Date.parse(expense.deletedAt) <= instant) return null;
  // Première révision postérieure à `at` (ordre du repo non présumé).
  const revision = (expense.revisions ?? [])
    .filter((r) => Date.parse(r.replacedAt) > instant)
    .sort((a, b) => Date.parse(a.replacedAt) - Date.parse(b.replacedAt))[0];
  const state = revision
    ? {
        label: revision.label,
        category: revision.category,
        grossCents: revision.grossCents,
        payerId: revision.payerId,
        incurredOn: revision.incurredOn,
        shares: revision.shares,
        aids: revision.aids,
      }
    : {};
  const known = { ...expense, ...state, deletedAt: null };
  return {
    ...known,
    aids: known.aids.filter((a) => !a.createdAt || Date.parse(a.createdAt) <= instant),
  };
}

/**
 * Vue « solde » d'une dépense via le pipeline canonique (calc-engine) : parts
 * RECALCULÉES à partir des % figés et des aides passées — indispensable pour
 * rejouer un état antérieur où les aides (donc le net partagé) différaient.
 */
export function toBalanceExpense(expense: StoredExpense): BalanceExpense {
  const computed = computeExpense({
    grossCents: expense.grossCents,
    payerId: expense.payerId,
    ratio: expense.shares.map((s) => ({ memberId: s.memberId, pct: s.pctSnapshot })),
    aids: expense.aids,
  });
  return {
    grossCents: expense.grossCents,
    payerId: expense.payerId,
    shares: computed.shares.map((s) => ({ memberId: s.memberId, cents: s.cents })),
    effectiveAids: computed.effectiveAids,
    deletedAt: expense.deletedAt,
  };
}
