"use client";

import {
  createContext,
  useContext,
  useTransition,
  type ReactNode,
  type TransitionStartFunction,
} from "react";
import styles from "./GlobalProgress.module.css";

// Indicateur de chargement global (barre discrète en bas d'écran) : un unique
// `useTransition` partagé via contexte. Toute navigation (`router.push` du
// shell, filtres) ou action serveur qui passe par `useGlobalTransition` fait
// vivre la même barre — React agrège correctement les transitions qui se
// chevauchent (`isPending` reste vrai tant qu'une au moins est en cours).
type GlobalProgressContextValue = {
  isPending: boolean;
  startTransition: TransitionStartFunction;
};

const GlobalProgressContext = createContext<GlobalProgressContextValue | null>(null);

export function GlobalProgressProvider({ children }: { children: ReactNode }) {
  const [isPending, startTransition] = useTransition();

  return (
    <GlobalProgressContext.Provider value={{ isPending, startTransition }}>
      {children}
    </GlobalProgressContext.Provider>
  );
}

// Drop-in remplacement de `useTransition()` — même forme `[isPending, startTransition]`
// mais branché sur l'état partagé, pour que n'importe quel composant (navigation,
// formulaire, action) alimente la même barre de chargement.
export function useGlobalTransition(): [boolean, TransitionStartFunction] {
  const ctx = useContext(GlobalProgressContext);
  if (!ctx) {
    throw new Error("useGlobalTransition doit être utilisé sous GlobalProgressProvider");
  }
  return [ctx.isPending, ctx.startTransition];
}

export function GlobalProgressBar() {
  const ctx = useContext(GlobalProgressContext);
  const isPending = ctx?.isPending ?? false;

  return (
    <div
      className={`${styles.track} ${isPending ? styles.trackVisible : ""}`}
      role="progressbar"
      aria-hidden={!isPending}
      aria-label="Chargement en cours"
    >
      <div className={styles.bar} />
    </div>
  );
}
