// @app/shared — validations de FORME, pures, réutilisables par tous les domaines
// (spec-technique ch.7). Chaque validateur renvoie `AppError | null` (`null` =
// valide). Court-circuit via `firstError`.
//
// Ne couvre QUE la forme (indépendante de la DB). Les validations CONTEXTUELLES
// (payeur = membre du foyer) vivent dans le domaine car elles touchent la DB.

import type { AppError } from "./contract";

const validationError = (message: string, field: string): AppError => ({
  code: "VALIDATION_ERROR",
  message,
  field,
});

/** Montant en centimes : entier strictement positif (ch.7 « Montant brut > 0 »). */
export function validateAmountCents(cents: number): AppError | null {
  if (!Number.isInteger(cents) || cents <= 0) {
    return validationError(
      "Le montant doit être un nombre de centimes entier positif.",
      "grossCents",
    );
  }
  return null;
}

/** Ratio : au moins une part, chaque pct ≥ 0, Σ pct = 100 exactement (tolérance 0, ch.7). */
export function validateRatio(shares: { memberId: string; pct: number }[]): AppError | null {
  if (shares.length === 0) {
    return validationError("Le partage doit comporter au moins une part.", "shares");
  }
  for (const s of shares) {
    if (!Number.isFinite(s.pct) || s.pct < 0) {
      return validationError("Chaque part doit être un pourcentage positif ou nul.", "shares");
    }
  }
  const sum = shares.reduce((acc, s) => acc + s.pct, 0);
  if (sum !== 100) {
    return validationError("La somme des parts doit valoir exactement 100 %.", "shares");
  }
  return null;
}

/** Date métier requise, au format `date` (`YYYY-MM-DD`) valide (ch.7). */
export function validateIncurredOn(value: string): AppError | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return validationError("La date est requise au format AAAA-MM-JJ.", "incurredOn");
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    return validationError("La date est invalide.", "incurredOn");
  }
  return null;
}

/** Jour du mois de génération : entier entre 1 et 31 inclus (D12/D13, ch.7). */
export function validateDayOfMonth(day: number): AppError | null {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return validationError("Le jour du mois doit être un entier entre 1 et 31.", "dayOfMonth");
  }
  return null;
}

/** Libellé non vide (colonne `label` NOT NULL). */
export function validateLabel(label: string): AppError | null {
  if (label.trim().length === 0) {
    return validationError("Le libellé est requis.", "label");
  }
  return null;
}

/** Combinateur court-circuit : renvoie la première erreur non nulle, sinon `null`. */
export function firstError(...errs: (AppError | null)[]): AppError | null {
  for (const e of errs) {
    if (e) return e;
  }
  return null;
}
