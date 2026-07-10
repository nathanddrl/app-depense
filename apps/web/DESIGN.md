---
name: Étale
description: Système visuel de la retenue — angles droits, aucune ombre, une seule teinte d'accent qui encode la magnitude d'un écart, jamais son camp.
colors:
  surface-base: "oklch(0.97 0.012 170)"
  surface-card: "oklch(0.945 0.014 170)"
  surface-raised: "oklch(0.92 0.016 170)"
  border-subtle: "oklch(0.85 0.018 170)"
  border-strong: "oklch(0.75 0.02 170)"
  text-secondary: "oklch(0.52 0.02 170)"
  text-primary: "oklch(0.24 0.02 168)"
  surface-base-dark: "oklch(0.2 0.02 170)"
  surface-card-dark: "oklch(0.24 0.02 170)"
  surface-raised-dark: "oklch(0.28 0.022 170)"
  border-subtle-dark: "oklch(0.36 0.02 170)"
  border-strong-dark: "oklch(0.46 0.02 170)"
  text-secondary-dark: "oklch(0.72 0.016 170)"
  text-primary-dark: "oklch(0.95 0.01 168)"
  clay-fill: "oklch(0.62 0.085 55)"
  clay-text: "oklch(0.42 0.09 50)"
  clay-subtle: "oklch(0.72 0.06 55)"
  clay-moderate: "oklch(0.66 0.075 55)"
  clay-ceiling: "oklch(0.6 0.09 55)"
  clay-fill-dark: "oklch(0.68 0.075 55)"
  brick: "oklch(0.5 0.07 30)"
  brick-subtle: "oklch(0.9 0.03 30)"
  category-1: "oklch(0.62 0.035 150)"
  category-2: "oklch(0.62 0.03 190)"
  category-3: "oklch(0.6 0.035 130)"
  category-4: "oklch(0.58 0.03 205)"
  category-5: "oklch(0.64 0.032 165)"
  category-6: "oklch(0.56 0.028 220)"
  white: "oklch(1 0 0)"
typography:
  display-lg:
    fontFamily: "Fraunces Variable, Fraunces, serif"
    fontStyle: italic
    fontSize: "44px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.015em"
  display-md:
    fontFamily: "Fraunces Variable, Fraunces, serif"
    fontStyle: italic
    fontSize: "32px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.015em"
  display-sm:
    fontFamily: "Fraunces Variable, Fraunces, serif"
    fontStyle: italic
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.015em"
  title:
    fontFamily: "General Sans, -apple-system, sans-serif"
    fontSize: "22px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.01em"
  ui:
    fontFamily: "General Sans, -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.01em"
  body:
    fontFamily: "General Sans, -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  caption:
    fontFamily: "General Sans, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.01em"
  amount:
    fontFamily: "General Sans, -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    fontFeature: "tnum lnum"
rounded:
  none: "0px"
  subtle: "2px"
spacing:
  "1": "8px"
  "2": "16px"
  "3": "32px"
  "4": "56px"
  "5": "96px"
  "6": "120px"
components:
  button-primary:
    backgroundColor: "{colors.text-primary}"
    textColor: "{colors.surface-base}"
    typography: "{typography.ui}"
    rounded: "{rounded.none}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.text-secondary}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    typography: "{typography.ui}"
    rounded: "{rounded.none}"
    padding: "12px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.ui}"
    rounded: "{rounded.none}"
    padding: "12px 20px"
  input:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.subtle}"
    padding: "12px 16px"
  card:
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.none}"
    padding: "{spacing.3}"
  chip-category:
    backgroundColor: "{colors.category-1}"
    textColor: "{colors.white}"
    typography: "{typography.ui}"
    rounded: "{rounded.none}"
    size: "28px"
---

# Design System: Étale

## 1. Overview

**Creative North Star: "Le témoin immobile"**

Étale n'illustre pas l'équilibre financier d'un couple, elle le rend en position :
une ligne horizontale qui s'infléchit avec la magnitude d'un écart, jamais avec
son camp. Rien ne pop, tout se pose. Le système entier — angles droits, aucune
ombre, une seule teinte d'accent plafonnée dur — est la traduction visuelle
littérale d'un témoin fiable qui constate sans jamais prendre parti ni relancer.

La palette est volontairement pauvre : une ardoise glauque à teinte constante
(168–170° OKLCH) du fond au texte, et un unique accent minéral « argile » réservé
à une seule fonction — encoder la magnitude d'un écart, jamais deux couleurs
opposées pour « ton côté vs mon côté ». Un solde équilibré ne porte aucune
couleur : la résorption est un retour au neutre, jamais l'apparition d'un vert
« succès ». Ce système rejette explicitement le réflexe Tricount (badges,
streaks, félicitations, vert de succès) et le réflexe fintech perso type
Sumeria/Revolut (vocabulaire et code couleur de pilotage/optimisation) — les
deux anti-références de PRODUCT.md.

**Key Characteristics:**
- Angles droits partout ; une seule valeur de radius non nulle dans tout le
  système, réservée aux surfaces tactiles.
- Aucune ombre, jamais — la profondeur s'encode par la luminosité de surface.
- Une seule teinte d'accent (argile), plafonnée dur, jamais un second camp de
  couleur.
- Fraunces italique réservée aux constats déclaratifs ; tout le reste en
  General Sans, deux graisses seulement.
- Deux paliers de motion, décélération lourde, zéro overshoot, zéro spring.

## 2. Colors: The Ardoise Palette

Une ardoise glauque à teinte constante porte tout le système ; un unique accent
minéral module en intensité pour dire un seul fait : la taille d'un écart.

### Primary
- **Argile** (`oklch(0.62 0.085 55)` / `clay-fill`): l'unique accent du système.
  Un déclencheur par écran maximum — points, barres, états actifs. Encode
  exclusivement la magnitude d'un écart entre les deux membres du foyer, jamais
  un camp. Plafonnée dur à `clay-ceiling` (`oklch(0.6 0.09 55)`) : l'écart ne
  crie jamais plus fort que la marque, quel que soit le montant réel.
- **Argile lisible** (`oklch(0.42 0.09 50)` / `clay-text`): version texte de
  l'accent, conforme WCAG AA — non interchangeable avec `clay-fill`, qui sert
  uniquement à être vu (points, barres), jamais à être lu.

### Neutral
- **Ardoise fond** (`oklch(0.97 0.012 170)` / `surface-base`): fond de page.
  Teinte 170° constante — choisie contre le bleu océan (trop cinétique) et le
  violet fintech (ancrage marketing artificiel).
- **Ardoise surface** (`oklch(0.945 0.014 170)` / `surface-card`): cards,
  surfaces de contenu.
- **Ardoise surface élevée** (`oklch(0.92 0.016 170)` / `surface-raised`):
  élévation par luminosité, jamais par ombre.
- **Ardoise bordure discrète / marquée** (`oklch(0.85 0.018 170)` /
  `oklch(0.75 0.02 170)`): séparateurs, contours de champs.
- **Ardoise texte secondaire** (`oklch(0.52 0.02 170)` / `text-secondary`):
  labels, texte de support.
- **Ardoise texte primaire** (`oklch(0.24 0.02 168)` / `text-primary`): texte
  courant, fond de bouton primaire.
- Le dark theme réutilise la même teinte 170° à luminosité inversée (`*-dark`)
  — il ne descend jamais vers un noir sans chroma.

### Erreurs système
- **Brique** (`oklch(0.5 0.07 30)` / `brick`): erreurs techniques uniquement.
  Teinte isolée à ~30°, structurellement séparée de l'échelle argile — aucun
  token n'est partagé entre les deux, par construction, pas seulement par
  convention.

### Catégories
- **Rotation catégories** (`category-1` à `category-6`, gris-verts 130–220°):
  couleur auto-assignée aux dépenses selon une rotation fixe. Jamais l'accent
  argile, réservé exclusivement à l'écart.

### Named Rules
**La règle du plafond dur.** L'accent argile ne dépasse jamais `clay-ceiling`
quelle que soit la magnitude réelle de l'écart — la marque ne se laisse jamais
dominer visuellement par un montant.

**La règle de l'écart neutre.** Un solde à zéro ne porte aucune couleur. La
résorption est un retour au gris, jamais l'apparition d'un vert de succès.

## 3. Typography

**Display Font:** Fraunces Variable (italique uniquement), avec repli serif
**Body Font:** General Sans (Regular 400 + Medium 500 uniquement), avec repli
`-apple-system, sans-serif`

**Character:** Un duo à deux graisses, point final. Fraunces italique est
réservée aux phrases de constat déclaratif (« vous êtes étale », « léa doit
42 € à nathan ») — jamais en romain, jamais sur un titre ou un label d'UI
chrome. General Sans porte tout le reste : navigation, corps, montants.

### Hierarchy
- **Display** (regular 400, italique, 44/32/24px selon le cran, line-height
  1.2): réservée aux phrases de constat déclaratif du solde. Jamais pour un
  titre de section.
- **Title** (medium 500, 22px, line-height 1.2, tracking +0.01em): titres de
  page/section en General Sans.
- **UI** (medium 500, 15px, tracking +0.01em): boutons, navigation, labels de
  chrome.
- **Body** (regular 400, 15px, line-height 1.55): texte courant. Plafond
  65–75ch.
- **Caption** (regular 400, 11px, tracking +0.01em): labels courts au-dessus
  d'un montant (ex. « solde ») — jamais en capitales.
- **Amount** (medium 500, 15px, chiffres tabulaires `tnum lnum`): montants.

### Named Rules
**La règle du montant discret.** La taille d'un montant est toujours alignée
sur le corps de texte environnant ; la différenciation se fait uniquement par
le poids (medium vs regular), jamais par la taille. Le montant n'est jamais le
sujet visuel de l'écran.

**La règle bas-de-casse.** Bas-de-casse quasi systématique, y compris le nom de
marque (« étale ») et des labels courts (« solde »). `text-transform:
uppercase` interdit partout ; un mot ne se distingue jamais par sa
capitalisation, seulement par sa position ou son poids.

## 4. Elevation

Aucune ombre, nulle part, y compris sur les overlays et modals. La profondeur
s'encode exclusivement par la luminosité de surface (`elevation-0/1/2` pointent
vers `surface-base/card/raised`). Une ombre, même infime, réintroduirait une
simulation de profondeur physique incohérente avec une matité totale assumée.
Les overlays se distinguent uniquement par un scrim d'assombrissement
(`surface-scrim`, `oklch(0.24 0.02 168 / 0.45)`), jamais par une ombre propre.

Seule exception à la platitude : un lavis radial de 2–4 % de luminosité sur le
canvas de fond — aucun dégradé sur un élément interactif, jamais.

### Named Rules
**La règle zéro ombre.** `box-shadow` n'apparaît nulle part dans le système, à
aucun niveau d'élévation, y compris les modals. Sans exception.

## 5. Components

Composants React purs, ne consommant que des tokens sémantiques (jamais une
primitive directement) — la règle à trois tiers (primitive → sémantique →
composant) est la garde-fou qui empêche la dérive vers l'app générique.

### Buttons
- **Shape:** angle droit strict (`rounded-none`, 0px) — jamais arrondi.
- **Primary:** fond `text-primary`, texte `surface-base`, padding 12px 20px,
  typographie UI (medium, tracking +0.01em).
- **Secondary:** transparent, contour `border-strong`, texte `text-primary`.
- **Ghost:** transparent, texte `text-secondary`.
- **Hover / Focus:** transition sur `motion.micro` (300ms, décélération
  lourde) ; primary → fond `text-secondary` ; secondary → contour
  `text-primary` ; ghost → texte `text-primary`. Anneau de focus en argile
  (`focus-ring`).
- Texte seul, jamais d'icône par défaut.

### Chips (CategoryChip)
- **Style:** aplat de couleur (rotation `category-1..6`) + initiale du nom
  saisi, en General Sans medium. Jamais un pictogramme littéral, jamais un
  color picker exposé — attribution automatique uniquement.
- **State:** pas d'état sélectionné distinct ; une couleur, une initiale, fixes
  par catégorie.

### Cards / Containers
- **Corner Style:** angle droit strict, jamais de radius.
- **Background:** `surface-card`, `surface-raised` pour l'élévation.
- **Shadow Strategy:** aucune — voir section Elevation.
- **Border:** aucune par défaut ; `border-subtle` seulement si nécessaire pour
  séparer un contenu.
- **Internal Padding:** `space-3` (32px) par défaut.

### Inputs / Fields
- **Style:** ligne unique, fond `surface-card`, `radius-subtle` (2px) —
  **la seule surface arrondie de tout le système**. Suffixe optionnel (ex.
  « € »).
- **Focus:** anneau `focus-ring` en argile.
- **Error:** texte/bordure en `brick`, jamais un token de l'échelle argile.

### Navigation (Tabs)
- **Style:** soulignement, pas de pilule, pas de fond coloré. Onglet actif
  distingué par un trait sous le label, jamais par une couleur de fond.

### WaterLine — composant signature
Ligne horizontale dont l'inflexion encode la magnitude d'un écart (-1..1) : à
0, ligne droite et couleur neutre (« étale »). Le signe donne la direction,
la valeur absolue pilote à la fois la profondeur de la courbe **et** le palier
de couleur argile jusqu'au plafond dur — jamais un encodage divergent entre
les deux. Transition sur `motion.settle` (600ms). Jamais un nombre dans un
badge coloré ; l'écart se lit en position, pas en étiquette.

### AmountDisplay
Chiffres tabulaires toujours ; différenciation exclusivement par le poids
(medium vs regular), jamais par la taille — voir Named Rule §3.

### BalanceStatement
Seul emplacement autorisé pour Fraunces italique — les phrases de constat
déclaratif du solde (« léa doit 42 € à nathan »), jamais un titre ou un label.

## 6. Do's and Don'ts

### Do:
- **Do** consommer les tokens sémantiques (`--surface-raised`) ; jamais une
  primitive directement (`--grey-2`) dans un composant.
- **Do** encoder un écart via la magnitude de `WaterLine` (ligne + une seule
  teinte, plafonnée à `clay-ceiling`).
- **Do** réserver `radius-subtle` (2px) exclusivement aux surfaces tactiles
  (inputs, tap targets).
- **Do** encoder la profondeur par la luminosité de surface (`--elevation-*`).
- **Do** réserver Fraunces italique aux phrases de constat déclaratif.
- **Do** différencier un montant par le poids (medium vs regular), jamais par
  la taille.
- **Do** nommer les personnes dans la copy (« léa doit 42 € à nathan »),
  jamais une formulation impersonnelle.
- **Do** auto-assigner couleur et initiale d'une catégorie, sans sélecteur
  manuel exposé.

### Don't:
- **Don't** utiliser un badge/pill coloré ou deux teintes opposées pour « les
  deux côtés » d'un écart — l'anti-réflexe Tricount explicite de PRODUCT.md.
- **Don't** arrondir une card, un bouton, un dialog ou un chip.
- **Don't** ajouter un `box-shadow` où que ce soit, y compris les modals.
- **Don't** ajouter un easing spring/bounce nulle part dans la codebase — deux
  paliers seulement, décélération lourde, zéro overshoot.
- **Don't** réutiliser un token de l'échelle `color-balance-*` pour une erreur
  technique, ni l'inverse — les deux sont isolées par construction.
- **Don't** utiliser `text-transform: uppercase` ou capitaliser pour
  l'emphase, nulle part.
- **Don't** faire apparaître un ton célébratoire, un vert de succès, un badge
  ou un streak — le réflexe Tricount rejeté par PRODUCT.md.
- **Don't** introduire un vocabulaire de pilotage/optimisation ou une couleur
  d'alerte pour un retard — le réflexe fintech (Sumeria/Revolut) rejeté par
  PRODUCT.md.
- **Don't** utiliser pièces, billets, cartes bancaires, portefeuilles,
  tirelires, personnages/avatars, mains qui se serrent, blobs mignons, émojis
  vectorisés, flèches de tendance boursière, confettis.
