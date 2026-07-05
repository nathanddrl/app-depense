// @app/domain-aid — retrait d'une aide rattachée à une dépense (spec ch.5.2).
//
// Retirer une aide augmente la charge nette : les parts figées sont recomputées
// via `calc-engine`. Même verrou de régularisation que `addAid`.

import { CalcPreconditionError } from "@app/calc-engine";
import { err, ok } from "@app/shared";
import type { ActionResult } from "@app/shared";
import { computeSharesAfterAids } from "./internal";
import type { AidRepository } from "./repository";
import type { AidContext, Expense, RemoveAidInput } from "./types";

export async function removeAid(
  repo: AidRepository,
  ctx: AidContext,
  input: RemoveAidInput,
): Promise<ActionResult<Expense>> {
  // 1) Résoudre l'aide vers sa dépense parente : absente → NOT_FOUND.
  const aidRef = await repo.getAidById(input.aidId);
  if (!aidRef) {
    return err("NOT_FOUND", "Aide introuvable.");
  }

  const expense = await repo.getExpenseForAid(aidRef.expenseId);
  if (!expense) {
    return err("NOT_FOUND", "Dépense introuvable.");
  }

  // 2) Autorité : le foyer est imposé par le seam, jamais par le client.
  if (expense.householdId !== ctx.householdId) {
    return err("FORBIDDEN", "Cette dépense n'appartient pas à votre foyer.");
  }

  // 3) Verrou de régularisation (ch.7 / D7).
  if (expense.settlementId !== null) {
    return err(
      "EXPENSE_LOCKED",
      "Cette dépense est rattachée à une régularisation et n'est plus modifiable.",
    );
  }

  // 4) Recompute des parts figées par le moteur (aide retirée des existantes).
  const remainingAids = expense.aids
    .filter((a) => a.id !== input.aidId)
    .map((a) => ({ beneficiaryId: a.beneficiaryId, amountCents: a.amountCents }));

  let shares;
  let warnings;
  try {
    const computed = computeSharesAfterAids(
      expense.grossCents,
      expense.payerId,
      expense.ratio,
      remainingAids,
    );
    shares = computed.shares;
    warnings = computed.warnings;
  } catch (e) {
    if (e instanceof CalcPreconditionError) {
      return err("VALIDATION_ERROR", "Répartition invalide.", "shares");
    }
    throw e;
  }

  // 5) Persistance atomique du retrait + des nouvelles parts.
  const updated = await repo.removeAid(input.aidId, shares);
  return ok(updated, warnings);
}
