// Vocabulaire de sortie du moteur de calcul (archi ch.1.4 / DA4).
//
// Volontairement AUTONOME : aucun import de @app/shared. `ActionResult`/`AppError`
// sont la forme d'une réponse de Server Action (couche contrat, spec ch.6.1) ; le
// moteur, lui, calcule. Il expose donc ses propres types, minimaux, pour rester
// « testable en isolation totale ». Le mapping vers le contrat (WarningCode,
// VALIDATION_ERROR) se fera dans la couche domaine/actions.

/** Identifiant d'un membre (opaque côté moteur). */
export type MemberId = string;

/** Une ligne de répartition en pourcentage (input). `pct` en % (numeric(5,2)). */
export interface SharePct {
  memberId: MemberId;
  pct: number;
}

/** Une aide rattachée à une dépense, perçue par un membre (input). */
export interface AidInput {
  beneficiaryId: MemberId;
  amountCents: number;
}

/** Une part figée d'un membre sur une dépense (output). Montant en centimes. */
export interface Share {
  memberId: MemberId;
  cents: number;
  /** % effectivement appliqué, pour transparence (spec 3.2 `share_pct_snapshot`). */
  pctSnapshot: number;
}

/**
 * Aide effective par bénéficiaire (output). Vaut le montant brut de l'aide en
 * régime normal ; en cas d'aide > charge (4.4), vaut le montant plafonné.
 */
export interface EffectiveAid {
  beneficiaryId: MemberId;
  effectiveCents: number;
}

/**
 * Avertissement de calcul — PAS une erreur, un état légitime (spec 4.4 / D11).
 * La valeur string est choisie identique au futur `shared.WarningCode` : le
 * mapping domaine → contrat sera l'identité.
 */
export type CalcWarning = "AID_EXCEEDS_CHARGE";

/**
 * Erreur de précondition du moteur (défense en profondeur). Dans le flux correct,
 * la validation serveur (spec ch.7) intercepte `brut ≤ 0`, `Σ pct ≠ 100`, etc.
 * AVANT d'appeler le moteur et renvoie `VALIDATION_ERROR`. Un moteur qui reçoit
 * une entrée invalide = bug de l'appelant → on throw plutôt que de produire un
 * résultat silencieux (invariant produit : le solde est toujours juste).
 */
export class CalcPreconditionError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "CalcPreconditionError";
    this.reason = reason;
  }
}
