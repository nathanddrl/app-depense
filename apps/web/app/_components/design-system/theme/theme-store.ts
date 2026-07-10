"use client";

// Petit store externe pour le thème courant (T-C9.2), lu via
// `useSyncExternalStore` dans `theme-toggle.tsx` — évite le pattern
// effet+setState (déclenche un rendu en cascade, cf. règle ESLint
// `react-hooks/set-state-in-effect`) et gère nativement la resynchronisation
// après hydratation (`getServerSnapshot` retombe sur « clair », cohérent avec
// `:root`/`ThemeScript`). Seul `setTheme` écrit `data-theme` : pas d'autre
// source externe à écouter, mais l'abonnement doit exister pour que le Switch
// se remette à jour après un clic.

import { THEME_STORAGE_KEY } from "./theme-storage";

const listeners = new Set<() => void>();

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
  if (isDark) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
  listeners.forEach((listener) => listener());
}
