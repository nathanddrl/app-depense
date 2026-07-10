// Clé localStorage partagée entre le script anti-FOUC (`theme-script.tsx`,
// bloquant, exécuté avant hydration) et le toggle (`theme-toggle.tsx`) — une
// seule source de vérité pour éviter que les deux dérivent (T-C9.2).
export const THEME_STORAGE_KEY = "etale-theme";
