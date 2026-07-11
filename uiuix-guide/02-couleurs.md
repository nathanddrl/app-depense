# Couleurs

## Principe — « humeur retenue »

Tous les neutres sont fixés sur une **teinte constante 168–170° en OKLCH**, à chroma
très bas (0.012–0.03) — une ardoise glauque. Choisie contre le bleu océan (trop
cinétique, appelle le mouvement) et contre le violet fintech (ancrage marketing
artificiel plutôt que sensoriel réel).

**Révisé le 11/07/2026 (voir `decisions-techniques.md`, « Refonte navigation & identité du solde »).** L'accent minéral encode désormais l'écart sur **deux teintes opposées selon la direction** (négatif/positif, perspective du lecteur), plus le neutre à zéro — reversal assumé du principe « une seule teinte jamais opposée » qui tenait jusqu'ici. Les deux teintes directionnelles restent plafonnées dur (même logique de plafond que l'ancien système à teinte unique) pour que l'écart ne crie jamais plus fort que la marque. Valeurs OKLCH exactes des deux teintes **non encore définies** — à trancher avant implémentation (voir `decisions-techniques.md`).

Un solde équilibré (écart = 0) ne porte **aucune couleur** — la résorption est un retour
au neutre. Ce point ne change pas : même à teintes directionnelles, un aller-retour positif→neutre n'est pas un vert « succès » qui s'éteint, c'est un retour à l'absence de couleur.

Les erreurs techniques ont leur propre teinte isolée (brique désaturé, ~30°) qui ne
partage **jamais** de token avec l'échelle de l'écart.

Le dark theme garde la même teinte 170° à luminosité inversée — il ne descend jamais
vers un noir sans chroma.

## Primitives (`tokens/colors.css`)

### Neutres (teinte 170° constante, seule la luminosité varie)

| Token | OKLCH | Rôle |
|---|---|---|
| `--grey-0` | `0.97 0.012 170` | fond |
| `--grey-1` | `0.945 0.014 170` | surface |
| `--grey-2` | `0.92 0.016 170` | surface élevée |
| `--grey-3` | `0.85 0.018 170` | bordure discrète |
| `--grey-4` | `0.75 0.02 170` | bordure marquée |
| `--grey-5` | `0.52 0.02 170` | texte secondaire |
| `--grey-6` | `0.24 0.02 168` | texte primaire |

### Neutres dark (même teinte, échelle inversée, jamais un noir sans chroma)

| Token | OKLCH |
|---|---|
| `--grey-dark-0` | `0.20 0.02 170` |
| `--grey-dark-1` | `0.24 0.02 170` |
| `--grey-dark-2` | `0.28 0.022 170` |
| `--grey-dark-3` | `0.36 0.02 170` |
| `--grey-dark-4` | `0.46 0.02 170` |
| `--grey-dark-5` | `0.72 0.016 170` |
| `--grey-dark-6` | `0.95 0.01 168` |

### Accent minéral « argile » — un déclencheur par écran maximum (teinte neutre/magnitude, écart = 0 ou non-directionnel)

| Token | OKLCH | Usage |
|---|---|---|
| `--clay-fill` | `0.62 0.085 55` | à voir : points, barres, états actifs (hors écart de solde depuis le 11/07) |
| `--clay-text` | `0.42 0.09 50` | à lire : conforme WCAG AA |
| `--clay-subtle` | `0.72 0.06 55` | magnitude faible (usage hors solde) |
| `--clay-moderate` | `0.66 0.075 55` | magnitude moyenne (usage hors solde) |
| `--clay-ceiling` | `0.60 0.09 55` | **plafond dur** — jamais dépassé quel que soit le montant réel |
| `--clay-fill-dark` | `0.68 0.075 55` | dark theme : éclairci + désaturé (évite l'effet néon) |

**Deux versions non interchangeables** : `fill` pour être vu (points, barres),
`text` pour être lu et rester conforme WCAG AA.

### Accent directionnel de l'écart — négatif / positif (nouveau, 11/07/2026)

Depuis la refonte du 11/07 (voir `decisions-techniques.md`), l'écart de solde n'utilise plus l'argile seule mais deux teintes opposées selon la direction (perspective du lecteur), plus le neutre à zéro. **Valeurs OKLCH non encore définies** — à trancher avec Nathan avant implémentation. Contraintes à respecter quelles que soient les valeurs retenues, héritées du principe « humeur retenue » toujours en vigueur pour le reste du système :
- Rester dans la famille de chroma bas du système (pas de rouge/vert saturés type feu de circulation) — cohérent avec le refus documenté du réflexe rouge=dette/vert=succès qui culpabilise, même si la distinction directionnelle existe désormais.
- Plafond dur par teinte (équivalent `--clay-ceiling`) — l'écart ne doit jamais crier plus fort que la marque, peu importe le montant réel.
- Neutre à écart nul reste sans couleur (voir plus haut) — les deux teintes directionnelles ne s'appliquent qu'à `abs(magnitude) > 0`.
- Dark theme : mêmes contraintes qu'ailleurs dans le système (teinte constante, luminosité inversée, jamais un noir sans chroma).

### Erreurs système — isolées, jamais mélangées à l'argile

| Token | OKLCH |
|---|---|
| `--brick` | `0.5 0.07 30` |
| `--brick-subtle` | `0.9 0.03 30` |

### Structurel

| Token | OKLCH |
|---|---|
| `--white` | `1 0 0` |

## Tokens sémantiques (`tokens/semantic.css`) — seuls consommés par les composants

**Nommage** : `catégorie.rôle`, jamais un nom qui présuppose la valeur (`gray-200`
interdit).

### Surfaces
`--surface-base`, `--surface-card`, `--surface-raised`, `--surface-overlay`,
`--surface-scrim` (`oklch(0.24 0.02 168 / 0.45)`)

### Bordures
`--border-subtle`, `--border-strong`

### Texte
`--text-primary`, `--text-secondary`, `--text-on-accent`, `--text-disabled`

### Échelle de balance / écart (révisée 11/07/2026 — directionnelle)

`--color-balance-none` (neutre, écart nul) / `--color-balance-negative-*` / `--color-balance-positive-*`
(paliers de magnitude par direction, structure exacte à définir — probablement le même nombre de
paliers que l'ancienne échelle non-directionnelle : subtle/moderate/ceiling, dédoublés par sens) —
structurellement isolée de `--color-system-error` / `--color-system-error-surface`
(aucun partage de token entre les deux, par construction, pour rendre le raccourci
impossible plutôt que déconseillé). **Ancienne échelle non-directionnelle** (`-subtle`/`-moderate`/`-marked`/`-ceiling`/`-text`
sans distinction de sens) **remplacée par ce nouveau schéma** — ne plus l'utiliser pour l'écart de solde.

### Catégories (dépenses)

`--category-1` à `--category-6` — rotation fixe, sous-famille de gris-verts, **jamais**
l'accent argile :

| Token | OKLCH |
|---|---|
| `--category-1` | `0.62 0.035 150` |
| `--category-2` | `0.62 0.03 190` |
| `--category-3` | `0.6 0.035 130` |
| `--category-4` | `0.58 0.03 205` |
| `--category-5` | `0.64 0.032 165` |
| `--category-6` | `0.56 0.028 220` |

### Focus

`--focus-ring`

## Dark theme (`[data-theme="dark"]`)

Seuls les tokens **sémantiques** changent — les primitives restent identiques, l'échelle
dark pointe simplement vers d'autres primitives.

Overrides : surfaces, bordures, texte, l'échelle `--color-balance-*` directionnelle (négatif/positif,
révisée 11/07/2026), `--focus-ring`. Rien d'autre.

## Fonds

Fonds plats et mats. Seule exception permise : un lavis radial de **2–4 % de luminosité**
sur le canvas de base. Aucun dégradé sur un élément interactif.

## Décision tranchée — disparition de l'accent à la résorption

Fondu progressif, jamais une disparition instantanée. Cohérent avec « rien ne pop, tout
se pose » — durée alignée sur `--motion-settle-extended-duration` (~1200ms), jamais un
cut sec (voir [`05-motion.md`](05-motion.md)).
