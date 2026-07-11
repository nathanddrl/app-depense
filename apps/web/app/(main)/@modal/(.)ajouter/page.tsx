"use client";

import { useRouter } from "next/navigation";
import { AddScreen } from "../../../_components/add/add-screen";

// Interception de /ajouter (navigation-ia §1.3) : overlay plein écran par-dessus
// l'onglet courant. Fermer (annuler / Échap / retour navigateur) = router.back()
// → revient exactement à l'écran d'origine, jamais un redirect vers accueil.
export default function AjouterModal() {
  const router = useRouter();
  return <AddScreen onClose={() => router.back()} />;
}
