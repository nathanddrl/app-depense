"use client";

// Pont props serveur → state local (T-CF3, corrige une régression T-CF1).
//
// Depuis T-CF1, les listes/cartes rafraîchies par fetch ciblé détiennent leur
// propre state, initialisé depuis les props du Server Component parent
// (`useState(initialX)`). Or `useState(x)` n'utilise son argument QU'AU
// MONTAGE : quand le RSC se re-rend et fournit de nouvelles props sans
// démonter le composant client (navigation `router.replace` sur les
// searchParams — ex. le filtre mois/catégorie de /mouvements), le state local
// reste figé sur les données du premier rendu. L'URL change, la liste non.
//
// Ce hook adopte la valeur serveur dès qu'elle change d'identité (nouvelle
// charge utile RSC), en gardant la valeur locale entre deux — les fetchs
// ciblés (`listExpensesAction` après une mutation, bus `data-refresh-bus`,
// retour au premier plan) continuent d'écrire dans le state sans être écrasés.
// C'est le motif « ajuster un state quand une prop change » documenté par
// React : la comparaison + le setState se font PENDANT le rendu (React relance
// aussitôt le rendu du seul composant concerné, avant toute peinture), jamais
// dans un `useEffect` — un effet peindrait d'abord l'ancien contenu, soit
// exactement le scintillement qu'on veut éviter.
//
// Volontairement PAS un `router.refresh()` : tout l'objet de T-CF1 est de s'en
// passer. Ici, aucune requête supplémentaire n'est déclenchée — on se contente
// de consommer la charge utile RSC que la navigation a déjà rapportée.

import { useState, type Dispatch, type SetStateAction } from "react";

export function useServerState<T>(serverValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(serverValue);
  // Dernière valeur serveur adoptée — sert uniquement de repère de comparaison
  // (l'identité suffit : chaque nouvelle charge utile RSC est désérialisée en
  // objets neufs, et un re-rendu client sans nouvelles données conserve les
  // mêmes références).
  const [syncedFrom, setSyncedFrom] = useState(serverValue);

  if (!Object.is(syncedFrom, serverValue)) {
    setSyncedFrom(serverValue);
    setValue(serverValue);
    return [serverValue, setValue];
  }

  return [value, setValue];
}
