"use client";

// Petit store externe pour le thème courant (T-C9.2), lu via
// `useSyncExternalStore` dans `theme-toggle.tsx` — évite le pattern
// effet+setState (déclenche un rendu en cascade, cf. règle ESLint
// `react-hooks/set-state-in-effect`) et gère nativement la resynchronisation
// après hydratation (`getServerSnapshot` retombe sur « clair », cohérent avec
// `:root`/`ThemeScript`). `setTheme` (choix manuel) et le listener système
// ci-dessous sont les deux seules sources qui écrivent `data-theme`.

import { THEME_STORAGE_KEY } from "./theme-storage";

const listeners = new Set<() => void>();

function applyTheme(isDark: boolean): void {
  if (isDark) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

// Tant que l'utilisateur n'a jamais choisi explicitement (pas de clé en
// localStorage), le thème suit en direct la préférence système — cohérent
// avec `ThemeScript` qui pose la valeur initiale de la même façon. Un choix
// manuel dans /reglages prend le pas et n'est plus jamais écrasé par un
// changement système ultérieur.
if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
    if (localStorage.getItem(THEME_STORAGE_KEY) === null) {
      applyTheme(event.matches);
      listeners.forEach((listener) => listener());
    }
  });
}

export function subscribeTheme(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getThemeSnapshot(): boolean {
  return document.documentElement.dataset.theme === "dark";
}

export function getServerThemeSnapshot(): boolean {
  return false;
}

export function setTheme(isDark: boolean): void {
  applyTheme(isDark);
  localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
  listeners.forEach((listener) => listener());
}
