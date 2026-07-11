// Parsing d'un montant saisi (champ texte, décimale virgule ou point) en centimes
// entiers. Partagé par tous les formulaires de saisie (dépense, aide, récurrence,
// édition admin) — auparavant réimplémenté en 5 exemplaires divergents.

/** `"12,50" → 1250` ; `null` si `raw` n'est pas un montant exploitable — jamais de NaN renvoyé au serveur. */
export function parseAmountToCents(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
