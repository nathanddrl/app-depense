import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeExpense, computeBalance } from "./index";
import type { BalanceExpense, SharePct } from "./index";

// Convertit des poids entiers arbitraires en un ratio dont Σ pct = 100 exact
// (via centièmes entiers + reliquat sur la 1re ligne). Garantit une entrée valide.
function toRatio(ids: string[], weights: number[]): SharePct[] {
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  const hundredths = weights.map((w) => Math.floor((10000 * w) / totalWeight));
  hundredths[0] += 10000 - hundredths.reduce((s, h) => s + h, 0);
  return ids.map((id, i) => ({ memberId: id, pct: hundredths[i] / 100 }));
}

const householdArb = fc.integer({ min: 2, max: 4 }).chain((n) => {
  const ids = Array.from({ length: n }, (_, i) => `m${i}`);
  const memberIdx = fc.integer({ min: 0, max: n - 1 });
  const expenseArb = fc.record({
    grossCents: fc.integer({ min: 1, max: 1_000_000 }),
    payer: memberIdx,
    weights: fc.array(fc.integer({ min: 1, max: 100 }), {
      minLength: n,
      maxLength: n,
    }),
    // amountCents volontairement large → couvre les cas aide > charge (4.4).
    aids: fc.array(
      fc.record({ beneficiary: memberIdx, amountCents: fc.integer({ min: 1, max: 2_000_000 }) }),
      { maxLength: 3 },
    ),
    deletedAt: fc.boolean(),
    settlementConfirmed: fc.boolean(),
  });
  return fc.record({
    ids: fc.constant(ids),
    expenses: fc.array(expenseArb, { minLength: 1, maxLength: 12 }),
  });
});

describe("PROPERTY — invariant produit #1 : Σ solde(m) = 0 (spec 4.2)", () => {
  it("sur des dépenses aléatoires (payeurs, ratios, aides, dépassements), Σ solde = 0 et Σ parts = net", () => {
    fc.assert(
      fc.property(householdArb, ({ ids, expenses }) => {
        const balanceExpenses: BalanceExpense[] = expenses.map((e) => {
          const payerId = ids[e.payer];
          const ratio = toRatio(ids, e.weights);
          const aids = e.aids.map((a) => ({
            beneficiaryId: ids[a.beneficiary],
            amountCents: a.amountCents,
          }));
          const c = computeExpense({ grossCents: e.grossCents, payerId, ratio, aids });

          // Invariant local : la répartition somme exactement à la charge nette.
          const sumShares = c.shares.reduce((s, x) => s + x.cents, 0);
          expect(sumShares).toBe(c.netCents);

          return {
            grossCents: e.grossCents,
            payerId,
            shares: c.shares.map((s) => ({ memberId: s.memberId, cents: s.cents })),
            effectiveAids: c.effectiveAids,
            deletedAt: e.deletedAt ? new Date() : null,
            settlementConfirmed: e.settlementConfirmed,
          };
        });

        // Le filtre (supprimé / confirmé) ne casse jamais l'invariant : tout
        // sous-ensemble de dépenses somme encore à 0.
        const bal = computeBalance(balanceExpenses, ids);
        const total = ids.reduce((s, id) => s + bal[id], 0);
        expect(total).toBe(0);
      }),
      { numRuns: 2000 },
    );
  });
});
