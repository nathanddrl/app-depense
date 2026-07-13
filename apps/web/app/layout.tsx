import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { fraunces, generalSans } from "./fonts";
import { ThemeScript } from "./_components/design-system/theme";
import { GlobalProgressProvider, GlobalProgressBar } from "./_components/design-system/feedback";
import "./styles/styles.css";

export const metadata: Metadata = {
  title: "Étale",
  description: "Gestion de dépenses partagées d'un foyer",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Étale",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  other: {
    // Next 16 n'émet plus que `mobile-web-app-capable` (standard non préfixé) via
    // `appleWebApp`. Safari iOS historique ne reconnaît que la meta préfixée
    // `apple-` pour le mode standalone (PC-3, cible iOS prioritaire) : on la
    // rajoute manuellement pour la compatibilité large des versions iOS.
    "apple-mobile-web-app-capable": "yes",
  },
};

// `viewport-fit=cover` (PC-3, cible iOS) : l'app peut s'étendre sous l'encoche/la
// zone home indicator en standalone. `themeColor` remplace la meta `theme-color`
// dans `metadata` depuis Next 13+ (convention dédiée).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#16221d",
};

// Thème (T-C9.2) : clair/sombre suit la préférence système par défaut, sauf
// choix explicite persisté par l'utilisateur (toggle dans /reglages,
// `theme-toggle.tsx`). `ThemeScript` applique la bonne valeur avant hydration
// pour éviter le flash. Jamais de `data-theme` en dur ici.
// `suppressHydrationWarning` : `ThemeScript` modifie l'attribut `data-theme`
// de `<html>` avant que React hydrate, donc le DOM réel diffère légitimement
// du HTML serveur sur cet unique attribut — pattern standard (next-themes
// fait de même), pas une désactivation générale de la vérification.
export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="fr"
      className={`${fraunces.variable} ${generalSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript nonce={nonce} />
      </head>
      <body>
        <GlobalProgressProvider>
          {children}
          <GlobalProgressBar />
        </GlobalProgressProvider>
      </body>
    </html>
  );
}
