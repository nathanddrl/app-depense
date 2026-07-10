import type { ReactNode } from "react";
import { MainBottomNav } from "./main-bottom-nav";

// Shell des écrans authentifiés (navigation-ia CN1) : compose la BottomNav et le
// slot parallèle @modal (écran « ajouter » en overlay via interception). Login
// reste hors de ce groupe → aucune BottomNav. La réserve de place en bas évite
// que le dernier contenu passe sous la barre fixe (hauteur ~56px + safe area).
export default function MainLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  return (
    <div style={{ paddingBottom: "calc(56px + env(safe-area-inset-bottom))" }}>
      {children}
      {modal}
      <MainBottomNav />
    </div>
  );
}
