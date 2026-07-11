"use client";

// Invitation première saisie (spec 8.6, T-C9.1) : visible uniquement quand le
// foyer n'a jamais eu de dépense (page.tsx, `showFirstExpenseInvite`), distinct
// d'un solde nul avec historique existant. Ton du guide de voix
// (uiuix-guide/01-essence-et-voix.md) : constat factuel en prose via `Notice`,
// jamais d'impératif — l'action est portée par le libellé infinitif du bouton.
// Ouvre l'écran ajouter (T-CN2.2) : même mécanisme que l'onglet nav (interception
// depuis l'accueil, T-CN1.3), pas de paramètre de mode — l'écran s'ouvre déjà en
// « une fois » par défaut.

import { useRouter } from "next/navigation";
import { Card, Button } from "../design-system/core";
import { Notice } from "../design-system/feedback";
import { Stack } from "../design-system/layout";

export function FirstExpenseInvite() {
  const router = useRouter();

  return (
    <Card>
      <Stack gap={2}>
        <Notice>aucune dépense n&apos;a encore été enregistrée pour ce foyer</Notice>
        <Button variant="primary" onClick={() => router.push("/ajouter")}>
          ajouter une dépense
        </Button>
      </Stack>
    </Card>
  );
}
