# Espacement, radius, élévation

## Espacement (`tokens/spacing.css`)

Échelle qui **saute large plutôt que dense** — la densité est l'exception qu'on
justifie, jamais le défaut. Volontairement **aucun palier intermédiaire entre 32 et
56**.

| Token | Valeur |
|---|---|
| `--space-1` | 8px |
| `--space-2` | 16px |
| `--space-3` | 32px |
| `--space-4` | 56px |
| `--space-5` | 96px |
| `--space-6` | 120px (= `--space-section-gap`) |

## Radius (`tokens/radius.css`)

**Quasi nul.** Une seule valeur non-zéro dans tout le système.

| Token | Valeur | Usage |
|---|---|---|
| `--radius-none` | 0px | tout le reste — cards, boutons, dialogs, chips |
| `--radius-subtle` | 2px | **exclusivement** les surfaces tactiles (inputs, tap targets) |

L'angle droit est le signe de l'immobilité, à rebours de l'arrondi « friendly » du SaaS
générique. Ne jamais arrondir une card, un bouton, un dialog ou un chip.

## Élévation (`tokens/elevation.css`)

La profondeur s'encode **exclusivement par la luminosité de surface**, jamais par une
ombre portée — y compris sur les overlays/modals.

```css
--elevation-0: var(--surface-base);
--elevation-1: var(--surface-card);
--elevation-2: var(--surface-raised);
--elevation-shadow: none; /* toujours, sans exception */
```

**Décision tranchée — ombre sur overlay/modal** : suppression totale de l'ombre, y
compris sur `elevation.2`. Les overlays se distinguent exclusivement par un scrim
d'assombrissement du fond (`--surface-scrim`), aucune ombre propre sur l'élément.

Raison actée dans le document de marque : une ombre, même infime, réintroduit une
simulation de profondeur physique incohérente avec une matité totale assumée — autant
tenir le principe jusqu'au bout plutôt que garder une entorse « juste pour cette fois ».

## Fonds

Fonds plats et mats. Seule exception permise dans tout le système : un lavis radial de
**2–4 % de luminosité** sur le canvas de base (`--surface-base`). Aucun dégradé sur un
élément interactif, jamais.
