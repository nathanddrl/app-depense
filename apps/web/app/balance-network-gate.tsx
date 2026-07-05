"use client";

// Garde réseau de la carte de solde (PC-2, DA9) : offline = app shell + écriture
// seulement, AUCUN cache client de données. Le solde exige le réseau pour être
// frais ; hors ligne, on ne sert jamais un chiffre potentiellement faux — le
// bandeau REMPLACE le montant (jamais une valeur silencieusement obsolète à côté).

import { useSyncExternalStore, type ReactNode } from "react";
import styles from "./balance-network-gate.module.css";

function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

/** Rendu serveur : identique au contenu (pas de `navigator` côté serveur). */
function getServerSnapshot(): boolean {
  return true;
}

export function BalanceNetworkGate({ children }: { children: ReactNode }) {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!online) {
    return <p className={styles.offline}>Hors ligne — solde non à jour</p>;
  }

  return <>{children}</>;
}
