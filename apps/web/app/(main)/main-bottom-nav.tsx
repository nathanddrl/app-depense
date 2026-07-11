"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, ArrowLeftRight, Settings } from "lucide-react";
import { BottomNav, type BottomNavItem } from "../_components/design-system/navigation";

// Câblage app du shell : mappe le pathname → item actif et pousse la navigation.
// Le composant BottomNav (kit) reste purement présentiel ; c'est ici que vivent
// la config des 3 destinations et la résolution de l'écran courant.

const ITEMS: BottomNavItem[] = [
  { icon: Home, label: "accueil", value: "accueil" },
  { icon: ArrowLeftRight, label: "mouvements", value: "mouvements" },
  { icon: Settings, label: "réglages", value: "reglages" },
];

// Chaque destination correspond à un préfixe de route ; l'accueil est la racine.
// admin est un sous-écran de réglages (navigation-ia §1.1) → réglages reste allumé.
function activeFromPathname(pathname: string): string {
  if (pathname.startsWith("/mouvements")) return "mouvements";
  if (pathname.startsWith("/reglages") || pathname.startsWith("/admin")) return "reglages";
  return "accueil";
}

const ROUTE_BY_VALUE: Record<string, string> = {
  accueil: "/",
  mouvements: "/mouvements",
  reglages: "/reglages",
};

export function MainBottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <BottomNav
      items={ITEMS}
      active={activeFromPathname(pathname)}
      onNavigate={(value) => {
        const href = ROUTE_BY_VALUE[value];
        if (href) router.push(href);
      }}
    />
  );
}
