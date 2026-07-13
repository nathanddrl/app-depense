"use client";

// CTA persistant vers l'écran ajouter (T-CN2.4) : depuis le retrait de
// « ajouter » de la BottomNav (T-CN1.4), c'est l'unique point d'entrée
// permanent, toujours visible peu importe l'historique du foyer. Route en
// mode ponctuel par défaut — même mécanisme d'interception que l'ancien
// onglet nav (T-CN1.1/T-CN1.3), rien à changer côté ouverture/fermeture.
// Distinct de FirstExpenseInvite, qui ne s'affiche que sur un foyer neuf et
// n'a plus son propre bouton pour éviter la duplication (voir page.tsx).

import { useRouter } from "next/navigation";
import { Button } from "../design-system/core";
import { useGlobalTransition } from "../design-system/feedback";

export function AddExpenseButton() {
  const router = useRouter();
  const [, startTransition] = useGlobalTransition();

  return (
    <Button variant="primary" onClick={() => startTransition(() => router.push("/ajouter"))}>
      ajouter une dépense
    </Button>
  );
}
