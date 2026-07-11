// Invitation première saisie (spec 8.6, T-C9.1) : visible uniquement quand le
// foyer n'a jamais eu de dépense (page.tsx, `showFirstExpenseInvite`), distinct
// d'un solde nul avec historique existant. Ton du guide de voix
// (uiuix-guide/01-essence-et-voix.md) : constat factuel en prose via `Notice`,
// jamais d'impératif. Pas de bouton propre (T-CN2.4) : `AddExpenseButton` est
// désormais affiché en permanence sur l'accueil et ferait doublon ici — cette
// invite ne porte plus que le constat.

import { Card } from "../design-system/core";
import { Notice } from "../design-system/feedback";

export function FirstExpenseInvite() {
  return (
    <Card>
      <Notice>aucune dépense n&apos;a encore été enregistrée pour ce foyer</Notice>
    </Card>
  );
}
