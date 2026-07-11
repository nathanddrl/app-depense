"use client";

import { useRouter } from "next/navigation";
import { AddScreen } from "../_components/add/add-screen";

// Repli plein écran (navigation-ia §1.3) : accès direct ou refresh sur /ajouter,
// hors du groupe (main) donc sans BottomNav. Pas d'origine in-app (entrée
// fraîche) → fermer ramène à l'accueil, seule destination sensée ici.
export default function AjouterPage() {
  const router = useRouter();
  return <AddScreen onClose={() => router.push("/")} />;
}
