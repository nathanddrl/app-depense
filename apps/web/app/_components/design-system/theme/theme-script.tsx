import { THEME_STORAGE_KEY } from "./theme-storage";

// Empêche le flash clair→sombre (ou l'inverse) au chargement (T-C9.2) :
// script bloquant posé dans <head>, exécuté avant le premier paint. Priorité
// au choix explicite persisté ; à défaut, on suit `prefers-color-scheme` de
// l'appareil (cf. listener système dans `theme-store.ts`, même logique).
export function ThemeScript() {
  const script = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
    THEME_STORAGE_KEY,
  )});var d=s==="dark"||(s===null&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d){document.documentElement.setAttribute("data-theme","dark")}}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
