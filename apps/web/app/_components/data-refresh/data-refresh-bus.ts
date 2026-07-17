"use client";

// Bus de notification pur mécanique (T-CF1) : aucune logique métier, juste un
// signal "cette catégorie de données vient de changer" entre composants
// montés sur des sous-arbres distincts qui ne partagent pas de props (ex. la
// carte de solde derrière la modale interceptée d'ajout). Remplace le
// `router.refresh()` systématique — chaque abonné décide lui-même quelle
// Server Action de lecture rejouer et met à jour son propre state local.

type Topic = "expenses" | "balance";

const listeners: Record<Topic, Set<() => void>> = {
  expenses: new Set(),
  balance: new Set(),
};

export function notifyDataChanged(topics: readonly Topic[]): void {
  for (const topic of topics) {
    for (const listener of listeners[topic]) listener();
  }
}

export function subscribeDataChanged(topic: Topic, listener: () => void): () => void {
  listeners[topic].add(listener);
  return () => listeners[topic].delete(listener);
}
