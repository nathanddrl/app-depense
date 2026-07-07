// Dérive la magnitude de WaterLine (7 : design-system/balance) à partir du solde.
// Signe = perspective du lecteur courant (positif si on lui doit de l'argent,
// négatif s'il doit lui-même), cohérent avec le vocabulaire de la phrase affichée
// juste au-dessus. Aucune règle produit n'existe pour l'amplitude : normalisation
// arbitraire plafonnée à un montant de référence de 150 € (WATER_LINE_REFERENCE_CENTS)
// — au-delà, l'écart est visuellement "plein" (magnitude ±1). Heuristique de
// présentation pure, volontairement hors de calc-engine (aucun calcul financier).

const WATER_LINE_REFERENCE_CENTS = 15_000;

export function waterLineMagnitude(amountCents: number, isCreditor: boolean): number {
  const normalized = Math.min(amountCents / WATER_LINE_REFERENCE_CENTS, 1);
  if (normalized === 0) return 0; // évite -0 (solde nul → toujours +0, jamais de signe)
  return isCreditor ? normalized : -normalized;
}
