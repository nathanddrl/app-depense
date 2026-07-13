import { THEME_STORAGE_KEY } from "./theme-storage";

// Empêche le flash clair→sombre (ou l'inverse) au chargement (T-C9.2) :
// script bloquant posé dans <head>, exécuté avant le premier paint. Priorité
// au choix explicite persisté ; à défaut, on suit `prefers-color-scheme` de
// l'appareil (cf. listener système dans `theme-store.ts`, même logique).
// `nonce` vient du header `x-nonce` posé par proxy.ts (CSP script-src
// stricte, sans 'unsafe-inline' — audit sécurité M1, 2026-07-13).
// `suppressHydrationWarning` sur le `nonce` : les navigateurs masquent
// délibérément l'attribut `nonce` côté client après rendu (protection contre
// sa lecture par un script tiers injecté), donc React le voit vide au diff —
// faux positif documenté, pas une vraie divergence SSR/client.
export function ThemeScript({ nonce }: { nonce?: string }) {
  const script = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
    THEME_STORAGE_KEY,
  )});var d=s==="dark"||(s===null&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d){document.documentElement.setAttribute("data-theme","dark")}}catch(e){}})();`;

  return (
    <script
      nonce={nonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
