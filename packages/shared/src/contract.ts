// @app/shared — contrat d'interface partagé (spec-technique ch.6.1 + 6.3).
//
// Envelope générique, sérialisable et transport-agnostique : aucun couplage à
// Next.js/React ni à Supabase. C'est déjà la forme qu'aurait une réponse d'API le
// jour d'une extraction (archi ch.2.1). Figée maintenant : les domaines à venir
// (aides C5, régularisation C6, récurrence C7) s'y réfèrent sans la redéfinir.

/** Résultat normalisé de toute Server Action / fonction de domaine (ch.6.1). */
export type ActionResult<T> =
  { ok: true; data: T; warnings?: AppWarning[] } | { ok: false; error: AppError };

export type AppError = { code: ErrorCode; message: string; field?: string };
export type AppWarning = { code: WarningCode; message: string };

/**
 * Catalogue COMPLET des codes d'erreur (ch.6.3), figé dès maintenant même si
 * certains ne servent qu'aux chantiers suivants — c'est un contrat stable.
 */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_MEMBER"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "EXPENSE_LOCKED"
  | "BALANCE_ALREADY_ZERO"
  | "SETTLEMENT_PENDING_EXISTS"
  | "CONFLICT";

/**
 * Codes de warning (ch.6.3). `AID_EXCEEDS_CHARGE` a une valeur string IDENTIQUE au
 * `CalcWarning` du calc-engine : le mapping moteur→contrat est l'identité, exercé
 * en C5 (aides). Un warning n'est jamais bloquant.
 */
export type WarningCode = "AID_EXCEEDS_CHARGE";

/** Constructeur d'un résultat de succès. */
export function ok<T>(data: T, warnings?: AppWarning[]): ActionResult<T> {
  return warnings && warnings.length > 0 ? { ok: true, data, warnings } : { ok: true, data };
}

/** Constructeur d'un résultat d'échec. */
export function err(
  code: ErrorCode,
  message: string,
  field?: string,
): { ok: false; error: AppError } {
  return { ok: false, error: field ? { code, message, field } : { code, message } };
}
