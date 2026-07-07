# Catalogue de composants

Composants du bundle source : React pur, ne consomment que des variables CSS (aucune
dépendance sauf `lucide-react` pour ceux qui utilisent une icône). Chacun existe dans le
zip sous forme `.jsx` (implémentation) + `.d.ts` (contrat de props) + `.prompt.md`
(rationale DA) dans `components/<groupe>/`.

**Ces `.jsx` sont des prototypes de design, pas du code à copier tel quel** dans
`apps/web` — recréer le rendu visuel avec la stack réelle du projet (React + CSS
variables, cf. [`08-integration-nextjs.md`](08-integration-nextjs.md)), pas forcément la
structure interne du prototype.

---

## `core/` — primitives

### Button

```ts
variant?: "primary" | "secondary" | "ghost"
size?: "md" | "sm"
disabled?: boolean
onClick?: () => void
type?: "button" | "submit"
```

Texte seul, pas d'icône par défaut. `primary` = fond plein sombre, `secondary` =
contour, `ghost` = texte seul.

Implémentation de référence (extrait) :

```jsx
const sizes = {
  md: { padding: "12px 20px", fontSize: "var(--text-body)" },
  sm: { padding: "8px 14px", fontSize: "var(--text-sm)" },
};

// base commune : font-body, weight-medium, tracking-title, border 1px transparent,
// radius-none, transition sur motion.micro, opacity 0.4 si disabled

const variants = {
  primary:   { background: "var(--text-primary)", color: "var(--surface-base)" },
  secondary: { background: "transparent", color: "var(--text-primary)", borderColor: "var(--border-strong)" },
  ghost:     { background: "transparent", color: "var(--text-secondary)" },
};
// hover : primary -> background var(--grey-5) ; secondary -> borderColor var(--text-primary) ;
// ghost -> color var(--text-primary)
```

### Input

```ts
label?: string
value: string
onChange?: (e) => void
placeholder?: string
type?: "text" | "number"
suffix?: string   // unité de fin, ex. "€"
```

Ligne unique, `radius-subtle` (2px — la seule surface arrondie du système), unité de
fin optionnelle.

### Card

```ts
children: React.ReactNode
raised?: boolean
padding?: string
```

Surface plate, aucune ombre, aucun radius, jamais.

### Checkbox

```ts
checked: boolean
onChange?: (checked: boolean) => void
label?: string
```

Sélecteur carré ; l'état coché remplit en solide (pas d'icône de coche).

### Radio

```ts
checked: boolean
onChange?: () => void
label?: string
```

Sélecteur rond.

### Switch

```ts
checked: boolean
onChange?: (checked: boolean) => void
label?: string
```

Toggle — ex. le mode confidentialité de l'écran de verrouillage.

---

## `balance/` — primitives spécifiques Étale

Ces quatre composants n'existent dans aucun système générique : ils sont dérivés
directement des signatures §4/§9 du document de marque (voir
[`01-essence-et-voix.md`](01-essence-et-voix.md)), pas des ajouts standards.

### WaterLine — le composant signature de la marque

```ts
magnitude?: number   // -1..1. 0 = étale (ligne droite, couleur neutre)
width?: number
height?: number
```

0 = étale (ligne droite, couleur neutre, pas d'accent). Le signe donne la direction de
l'écart, la valeur absolue donne à la fois la profondeur de l'inflexion **et** le palier
de couleur (même encodage, jamais divergent) jusqu'au plafond dur `clay-ceiling`. Rendu
comme une ligne horizontale, **jamais** un nombre dans un badge coloré.

Algorithme de référence (`WaterLine.jsx`) :

```jsx
function WaterLine({ magnitude = 0, width = 320, height = 64 }) {
  const abs = Math.min(Math.abs(magnitude), 1);
  const depth = abs * (height * 0.28);
  const midY = height / 2;
  const sign = magnitude < 0 ? -1 : 1;
  const cx = width / 2;

  const color =
    abs === 0 ? "var(--color-balance-none)" :
    abs < 0.25 ? "var(--color-balance-subtle)" :
    abs < 0.6 ? "var(--color-balance-moderate)" :
    "var(--color-balance-ceiling)";

  // courbe quadratique : point de contrôle au centre, déplacé verticalement de `depth`
  const path = `M 0 ${midY} Q ${cx} ${midY + sign * depth} ${width} ${midY}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"
        style={{ transition: `all var(--motion-settle-duration) var(--motion-settle-easing)` }} />
    </svg>
  );
}
```

Seuils de palier de couleur (mêmes seuils pilotent la couleur ET la profondeur de la
courbe — jamais un encodage divergent) :

| `abs(magnitude)` | Couleur |
|---|---|
| `= 0` | `--color-balance-none` |
| `< 0.25` | `--color-balance-subtle` |
| `< 0.6` | `--color-balance-moderate` |
| `>= 0.6` | `--color-balance-ceiling` |

### AmountDisplay

```ts
value: string
currency?: string
size?: "lg" | "md" | "sm"
weight?: "regular" | "medium"
tone?: "primary" | "secondary" | "balance"
```

Chiffres tabulaires toujours (`.tabular-nums`). Le montant n'est jamais le sujet visuel
de l'écran — différenciation par **poids**, pas par taille.

### BalanceStatement

```ts
children: React.ReactNode
size?: "lg" | "md" | "sm"
```

Fraunces italique — réservée exclusivement aux phrases de constat déclaratif
(« vous êtes étale », « léa doit 42 € à nathan »). Jamais pour un titre/label/UI chrome.

### CategoryChip

```ts
name: string
size?: number
```

Auto-assigné : initiale = première lettre de `name`, couleur = rotation fixe dans
`--category-1..6`. Pas de color picker manuel — jamais en exposer un (voir
[`06-iconographie.md`](06-iconographie.md)).

---

## `feedback/`

### Notice

```ts
children: React.ReactNode
tone?: "neutral" | "error"
```

Message factuel inline ; aucun ton célébratoire/succès n'existe par construction.

### Dialog

```ts
open: boolean
onClose?: () => void
title?: string
children: React.ReactNode
```

Overlay scrim uniquement (`--surface-scrim`) — zéro ombre à tout niveau d'élévation.

### Tooltip

```ts
children: React.ReactNode
label: string
```

Coins carrés, pas d'ombre.

---

## `navigation/`

### Tabs

```ts
items: { value: string; label: string }[]
active: string
onChange?: (value: string) => void
```

Style souligné — pas de pilule, pas de fond coloré.

### WaterSeparator

```ts
label?: string
```

Filet horizontal ; la ligne signature au repos (voir `WaterLine` pour la version
inflchie/dynamique).

---

## Kit d'écrans de référence (`ui_kits/app/`)

Recréation cliquable du flux cœur de l'app, composée entièrement à partir des
composants ci-dessus — utile comme référence de composition, pas comme code à copier :

- `Home.jsx` — solde + `WaterLine` héroïque + liste de mouvements récents
- `Movements.jsx` — liste groupée, `Tabs`
- `AddExpense.jsx` — formulaire (`Input`, `Button`)
- `Settings.jsx` — toggle confidentialité / écran de verrouillage (`Switch`)
- `AppShell.jsx` — coquille largeur mobile + nav du bas (icônes Lucide)

Exemple de composition (`Home.jsx`, extrait) :

```jsx
<span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", letterSpacing: "var(--tracking-title)" }}>
  solde
</span>

<WaterLine magnitude={0.35} width={280} height={72} />
<BalanceStatement>léa doit 42 € à nathan</BalanceStatement>

<WaterSeparator label="12 juin" />

{/* liste : CategoryChip + nom du payeur (text-secondary) + AmountDisplay size="sm" */}

<Button variant="primary" onClick={onOpenAdd}>ajouter une dépense</Button>
```
