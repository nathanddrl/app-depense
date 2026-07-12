import type { ReactNode } from "react";
import type { Metadata } from "next";
import { fraunces, generalSans } from "./fonts";
import { ThemeScript } from "./_components/design-system/theme";
import "./styles/styles.css";

export const metadata: Metadata = {
  title: "Étale",
  description: "Gestion de dépenses partagées d'un foyer",
};

// Thème (T-C9.2) : clair/sombre suit la préférence système par défaut, sauf
// choix explicite persisté par l'utilisateur (toggle dans /reglages,
// `theme-toggle.tsx`). `ThemeScript` applique la bonne valeur avant hydration
// pour éviter le flash. Jamais de `data-theme` en dur ici.
// `suppressHydrationWarning` : `ThemeScript` modifie l'attribut `data-theme`
// de `<html>` avant que React hydrate, donc le DOM réel diffère légitimement
// du HTML serveur sur cet unique attribut — pattern standard (next-themes
// fait de même), pas une désactivation générale de la vérification.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${fraunces.variable} ${generalSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
