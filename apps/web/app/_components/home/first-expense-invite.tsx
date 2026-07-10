"use client";

// Invitation première saisie (spec 8.6, T-C9.1) : visible uniquement quand le
// foyer n'a jamais eu de dépense (page.tsx, `showFirstExpenseInvite`), distinct
// d'un solde nul avec historique existant. Ton du guide de voix
// (uiuix-guide/01-essence-et-voix.md) : constat factuel en prose via `Notice`,
// jamais d'impératif — l'action est portée par le libellé infinitif du bouton.
// Pas de nouvelle route : le formulaire est déjà sur la page, on y scrolle.

import { Card } from "../design-system/core";
import { Button } from "../design-system/core";
import { Notice } from "../design-system/feedback";
import { Stack } from "../design-system/layout";

export function FirstExpenseInvite() {
  function handleClick() {
    document.getElementById("nouvelle-depense")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <Card>
      <Stack gap={2}>
        <Notice>aucune dépense n&apos;a encore été enregistrée pour ce foyer</Notice>
        <Button variant="primary" onClick={handleClick}>
          ajouter une dépense
        </Button>
      </Stack>
    </Card>
  );
}
