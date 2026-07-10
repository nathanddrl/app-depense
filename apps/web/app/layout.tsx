import type { ReactNode } from "react";
import type { Metadata } from "next";
import { fraunces, generalSans } from "./fonts";
import { ThemeScript, ThemeToggle } from "./_components/design-system/theme";
import "./styles/styles.css";

export const metadata: Metadata = {
  title: "Étale",
  description: "Gestion de dépenses partagées d'un foyer",
};

// Clair par défaut (T-C9.2) — le sombre n'est posé que par `ThemeScript`
// (avant hydration, depuis la préférence persistée) ou par `ThemeToggle`
// (choix utilisateur en direct). Jamais de `data-theme` en dur ici.
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
      <body>
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
