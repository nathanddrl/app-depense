"use client";

// Rafraîchit `onRefresh` une seule fois par transition arrière-plan → premier
// plan (T-CF2 : onglet caché puis revisité, app PWA réouverte après
// minimisation). Même mécanisme que `BalanceNetworkGate` (souscription à un
// événement navigateur via `useSyncExternalStore`) plutôt qu'un `useEffect`
// classique qui appellerait un setState — la détection de la transition et le
// déclenchement du refresh vivent tous les deux dans le gestionnaire natif de
// l'événement `visibilitychange`, jamais dans le corps d'un effet React.
// Aucun polling : un seul refetch par passage caché → visible.

import { useEffect, useRef, useSyncExternalStore } from "react";

function getSnapshot(): boolean {
  return document.visibilityState === "visible";
}

function getServerSnapshot(): boolean {
  return true;
}

export function useVisibilityRefresh(onRefresh: () => void): void {
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const wasHiddenRef = useRef(false);

  useSyncExternalStore(
    () => {
      const handleVisibilityChange = () => {
        if (document.visibilityState === "hidden") {
          wasHiddenRef.current = true;
          return;
        }
        if (wasHiddenRef.current) {
          wasHiddenRef.current = false;
          onRefreshRef.current();
        }
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    },
    getSnapshot,
    getServerSnapshot,
  );
}
