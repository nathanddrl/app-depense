import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeExpense, computeBalance } from "./index";
import type { BalanceExpense, SettlementForBalance, SharePct } from "./index";

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
  });
  // Règlements arbitraires (montants et statuts non contraints par rapport au
  // solde réel — computeBalance ne valide rien, c'est domain-settlement qui
  // valide à la création). Sert à vérifier que Σ solde = 0 tient quel que soit
  // le mélange de statuts/sens, même avec des montants "faux".
  const settlementArb = fc.record({
    fromIdx: memberIdx,
    toIdx: memberIdx,
    amountCents: fc.integer({ min: 1, max: 1_000_000 }),
    status: fc.constantFrom("pending", "confirmed", "cancelled") as fc.Arbitrary<
      SettlementForBalance["status"]
    >,
  });
  return fc.record({
    ids: fc.constant(ids),
    expenses: fc.array(expenseArb, { minLength: 1, maxLength: 12 }),
    settlements: fc.array(settlementArb, { maxLength: 5 }),
  });
});

describe("PROPERTY — invariant produit #1 : Σ solde(m) = 0 (spec 4.2)", () => {
  it("sur des dépenses aléatoires (payeurs, ratios, aides, dépassements), Σ solde = 0 et Σ parts = net", () => {
    fc.assert(
      fc.property(householdArb, ({ ids, expenses, settlements }) => {
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
          };
        });

        const settlementsForBalance: SettlementForBalance[] = settlements.map((s) => ({
          fromMemberId: ids[s.fromIdx],
          toMemberId: ids[s.toIdx],
          amountCents: s.amountCents,
          status: s.status,
        }));

        // Ni le filtre (dépense supprimée) ni les ajustements de règlements
        // (quel que soit leur statut/montant) ne cassent l'invariant.
        const bal = computeBalance(balanceExpenses, ids, settlementsForBalance);
        const total = ids.reduce((s, id) => s + bal[id], 0);
        expect(total).toBe(0);
      }),
      { numRuns: 2000 },
    );
  });
});
