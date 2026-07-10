import { THEME_STORAGE_KEY } from "./theme-storage";

// Empêche le flash clair→sombre au chargement (T-C9.2) : script bloquant posé
// dans <head>, exécuté avant le premier paint. Le clair reste la valeur par
// défaut (`:root`, semantic.css) — ce script ne pose `data-theme="dark"` sur
// <html> que si l'utilisateur l'a explicitement choisi et persisté. Aucun
// repli sur `prefers-color-scheme` — décision actée, pas de préférence
// système.
export function ThemeScript() {
  const script = `(function(){try{if(localStorage.getItem(${JSON.stringify(
    THEME_STORAGE_KEY,
  )})==="dark"){document.documentElement.setAttribute("data-theme","dark")}}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
