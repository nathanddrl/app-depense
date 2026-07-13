"use client";

// Store externe pour l'état d'installabilité PWA, lu via `useSyncExternalStore`
// dans `install-app-button.tsx` — même pattern que `theme-store.ts` (évite le
// pattern effet+setState, règle ESLint `react-hooks/set-state-in-effect`, et
// gère nativement la resynchronisation après hydratation).

// `beforeinstallprompt` est absent des types DOM (hors spec, Chrome/Edge
// desktop + Android uniquement).
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallStatus = "hidden" | "promptable" | "ios-manual";

const listeners = new Set<() => void>();
let deferredEvent: BeforeInstallPromptEvent | null = null;
let status: InstallStatus = "hidden";

function notify(): void {
  listeners.forEach((listener) => listener());
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// Apple impose à tout navigateur iOS (Safari, Chrome iOS, etc.) d'utiliser le
// moteur WebKit, qui n'implémente jamais `beforeinstallprompt` (PC-3, cible
// iOS prioritaire) — quel que soit le navigateur choisi par l'utilisateur sur
// iPhone/iPad, seule la procédure manuelle « Partager > Sur l'écran
// d'accueil » fonctionne.
function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1)
  );
}

if (typeof window !== "undefined") {
  if (!isStandalone() && isIOS()) {
    status = "ios-manual";
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredEvent = event as BeforeInstallPromptEvent;
    status = "promptable";
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredEvent = null;
    status = "hidden";
    notify();
  });
}

export function subscribeInstallStatus(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getInstallStatusSnapshot(): InstallStatus {
  return status;
}

export function getServerInstallStatusSnapshot(): InstallStatus {
  return "hidden";
}

export async function promptInstall(): Promise<void> {
  if (!deferredEvent) {
    return;
  }
  const event = deferredEvent;
  deferredEvent = null;
  await event.prompt();
  await event.userChoice;
  status = "hidden";
  notify();
}
