import type { ReactNode } from "react";
import type { Metadata } from "next";
import { fraunces, generalSans } from "./fonts";
import "./styles/styles.css";

export const metadata: Metadata = {
  title: "Étale",
  description: "Gestion de dépenses partagées d'un foyer",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" data-theme="dark" className={`${fraunces.variable} ${generalSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
