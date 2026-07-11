// Paramètre de route documentant l'intention d'ouverture de l'écran ajouter
// (navigation-ia §1.3). Consommé par les CTA d'invite (T-CN2.2) et par le
// Tabs ponctuel/récurrent de `add-screen.tsx` (T-CN4.2). `ADD_MODE_ONCE` n'a
// pas de contrepartie dans la querystring (mode par défaut, absence du
// paramètre) — exposé ici seulement comme valeur `Tabs`/état interne.
export const ADD_MODE_PARAM = "mode";
export const ADD_MODE_ONCE = "once";
export const ADD_MODE_RECURRENT = "recurrent";
