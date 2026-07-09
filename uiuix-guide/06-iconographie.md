# Iconographie et imagerie

Usage **délibérément quasi nul**, circonscrit à trois cas seulement. Tout le reste
(actions, items de menu) passe par le mot, jamais par un pictogramme.

## 1. Navigation et états système

Bibliothèque **Lucide** (MIT, tree-shakable, `lucide-react`), trait ajusté à **~1.25px**
via `strokeWidth={1.25}`. Dans le bundle source, chargée via CDN (`unpkg.com/lucide`)
pour le kit d'écrans — dans `apps/web`, préférer le package npm `lucide-react` plutôt
que le CDN.

Alternative de repli mentionnée dans le document de marque si besoin : Phosphor Icons
(poids « thin » natif).

## 2. Catégories (loyer, courses, sorties…)

**Jamais un pictogramme littéral.** Un aplat de couleur + l'initiale du nom de la
catégorie, en General Sans medium — voir composant `CategoryChip`
([`07-composants.md`](07-composants.md)).

- **Initiale** : première lettre du nom saisi par l'utilisateur.
- **Couleur** : rotation fixe dans la sous-palette `--category-1` à `--category-6`
  (gris-verts dérivés du neutre de marque) — **jamais** l'accent argile, réservé à
  l'écart.

### Décision tranchée — catégories personnalisées

Attribution **automatique** de l'initiale et de la couleur, **sans sélecteur manuel
exposé à l'utilisateur** — aucun color picker, jamais.

Raison : un color picker libre introduit un point de personnalisation chromatique hors
contrôle du système déjà verrouillé — inacceptable pour un produit dont toute la valeur
DA repose sur la retenue de palette.

## 3. États système / chargement

Pas de coche verte, pas de croix rouge.

- Étale (équilibré) = ligne droite immobile.
- Écart = ligne infléchie (`WaterLine`).
- Chargement = ondulation lente en boucle.
- Confirmation = amortissement type niveau à bulle qui se stabilise.

## Motif signature

La ligne d'eau horizontale comme séparateur de section (`WaterSeparator`), capable
d'une légère inflexion pour représenter l'écart (`WaterLine`) — proportionnelle à la
magnitude, même échelle que la couleur (voir [`02-couleurs.md`](02-couleurs.md)).

Le « é » reste un actif à part (favicon/avatar), **jamais** dispersé comme motif
décoratif générique.

## Interdits absolus

Pièces, billets, cartes bancaires, portefeuilles, tirelires, personnages/avatars, mains
qui se serrent, blobs mignons, émojis vectorisés, flèches de tendance boursière,
confettis, badges/streaks.

**Aucun emoji nulle part, ni en copy ni en iconographie.**

## Imagerie

Rien n'est spécifié dans le document source — aucun style de photographie ni
d'illustration n'a été défini. **Ne pas en inventer un** ; demander confirmation avant
d'ajouter de l'imagerie à un écran.
