"use client";

import { Dialog } from "../design-system/feedback";

// Shell de l'écran « ajouter » (navigation-ia §1.3/§3.3), partagé par les deux
// points d'entrée : la route interceptée (@modal/(.)ajouter) et le repli plein
// écran (/ajouter). Le conteneur seul en CN1 — le formulaire ponctuel/récurrent
// (bascule Tabs) arrive en CN4.1. onClose vient de l'appelant : back() pour
// l'interception (retour exact à l'origine), accueil pour le repli direct.
type Props = {
  onClose: () => void;
};

export function AddScreen({ onClose }: Props) {
  return (
    <Dialog open fullscreen title="ajouter" onClose={onClose}>
      <p style={{ color: "var(--text-secondary)" }}>bientôt disponible</p>
    </Dialog>
  );
}
