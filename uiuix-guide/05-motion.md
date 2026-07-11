# Motion

**Deux paliers seulement**, tous deux à décélération lourde et **zéro overshoot** — pas
de spring, pas de bounce, nulle part dans la codebase.

```css
/* tokens/motion.css */

/* le geste-signature : un solde qui se stabilise */
--motion-settle-duration: 600ms;
--motion-settle-easing: cubic-bezier(0.16, 1, 0.3, 1);

/* le settle étendu, utilisé uniquement pour l'accent qui s'efface entièrement à la résorption */
--motion-settle-extended-duration: 1200ms;

/* feedback d'interaction ordinaire */
--motion-micro-duration: 300ms;
--motion-micro-easing: cubic-bezier(0.16, 1, 0.3, 1);
```

| Palier | Durée | Easing | Usage |
|---|---|---|---|
| `motion.settle` | 600ms | `cubic-bezier(0.16, 1, 0.3, 1)` | geste-signature du solde qui se stabilise (`WaterLine`) |
| `motion.settle` étendu | 1200ms | idem | l'accent directionnel (négatif/positif, révisé 11/07/2026 — anciennement argile seule) qui s'efface entièrement à la résorption d'un écart |
| `motion.micro` | 300ms | `cubic-bezier(0.16, 1, 0.3, 1)` | feedback d'interaction ponctuel (hover, focus, toggle) |

**Règle** : les deux paliers utilisent la même courbe de décélération lourde. Aucun
spring bouncy nulle part dans la codebase — l'immobilité et la retenue priment même dans
le mouvement.

## États système animés

Pas de coche verte, pas de croix rouge.

- **Étale** (équilibré) = ligne droite, immobile.
- **Écart** = ligne infléchie (`WaterLine`, voir [`07-composants.md`](07-composants.md)).
- **Chargement** = ondulation lente en boucle.
- **Confirmation** = amortissement type niveau à bulle qui se stabilise (utilise
  `motion.settle`).
