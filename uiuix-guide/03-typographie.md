# Typographie

## Duo retenu

**Deux familles, deux graisses, point final.**

- **Fraunces** (italique **uniquement**) — réservée exclusivement aux phrases de
  constat déclaratif (« vous êtes étale », « léa doit 42 € à nathan »). Jamais en
  romain (trop mou), jamais sur un titre de section ou un label d'écran/UI chrome.
  Optical size réglé sur le cran display, jamais texte.
- **General Sans** (Regular 400 + Medium 500 **uniquement**, aucun bold/black nulle
  part) — tout le reste : UI, navigation, corps de texte, montants.

## Polices — fichiers et licences

Les deux familles sont fournies en binaires dans `assets/fonts/` du bundle source :

| Fichier                        | Usage                                                    |
| ------------------------------ | -------------------------------------------------------- |
| `Fraunces-Italic-Variable.ttf` | display italique, variable (poids 300–700)               |
| `Fraunces-Variable.ttf`        | roman — **non utilisée** dans le système (italique only) |
| `GeneralSans-Regular.woff2`    | corps, poids 400                                         |
| `GeneralSans-Medium.woff2`     | corps, poids 500                                         |
| `GeneralSans-Italic.woff2`     | italique General Sans (usage secondaire)                 |

Self-host obligatoire — pas de CDN. Fraunces licenciée pour l'usage fourni ; General
Sans est sous licence Fontshare (gratuite, y compris usage commercial).

```css
/* tokens/fonts.css */
@font-face {
  font-family: "Fraunces Variable";
  src: url("../assets/fonts/Fraunces-Italic-Variable.ttf") format("truetype-variations");
  font-weight: 300 700;
  font-style: italic;
  font-display: swap;
}

@font-face {
  font-family: "General Sans";
  src: url("../assets/fonts/GeneralSans-Regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
}

@font-face {
  font-family: "General Sans";
  src: url("../assets/fonts/GeneralSans-Medium.woff2") format("woff2");
  font-weight: 500;
  font-style: normal;
}

@font-face {
  font-family: "General Sans";
  src: url("../assets/fonts/GeneralSans-Italic.woff2") format("woff2");
  font-weight: 400;
  font-style: italic;
}
```

Dans `apps/web`, préférer `next/font/local` pour l'auto-hébergement plutôt que ces
`@font-face` bruts (voir [`08-integration-nextjs.md`](08-integration-nextjs.md)).

## Tokens (`tokens/typography.css`)

```css
--font-display: "Fraunces Variable", "Fraunces", serif;
--font-body: "General Sans", -apple-system, sans-serif;

--weight-regular: 400;
--weight-medium: 500;
```

### Échelle de tailles — General Sans

| Token         | Taille |
| ------------- | ------ |
| `--text-2xl`  | 40px   |
| `--text-xl`   | 28px   |
| `--text-lg`   | 22px   |
| `--text-md`   | 17px   |
| `--text-body` | 15px   |
| `--text-sm`   | 13px   |
| `--text-xs`   | 11px   |

### Échelle display — Fraunces italique (optical size = display, jamais texte)

| Token          | Taille |
| -------------- | ------ |
| `--display-lg` | 44px   |
| `--display-md` | 32px   |
| `--display-sm` | 24px   |

### Interlignage et tracking

| Token                | Valeur  |
| -------------------- | ------- |
| `--leading-body`     | 1.55    |
| `--leading-tight`    | 1.2     |
| `--tracking-title`   | 0.01em  |
| `--tracking-display` | 0.015em |

Réglages : tracking +1–2 % sur titres et constats, interligne 1.5–1.6 sur le texte
courant.

## Montants

Chiffres tabulaires **exclusivement** :

```css
--font-feature-amounts: "tnum" 1, "lnum" 1;
```

Appliqué via la classe utilitaire `.tabular-nums` (définie dans `tokens/base.css`) :

```css
.tabular-nums {
  font-feature-settings: var(--font-feature-amounts);
  font-variant-numeric: tabular-nums lining-nums;
}
```

**Règle non négociable** : la taille d'un montant est alignée sur le corps de texte
environnant. La différenciation se fait **uniquement par le poids** (medium vs
regular) — **jamais par la taille**. Le montant ne devient jamais le sujet visuel de
l'écran (voir composant `AmountDisplay`, [`07-composants.md`](07-composants.md)).

## Casse

Bas-de-casse **quasi systématique**, y compris le nom de marque (« étale »). Capitales
bannies partout, même pour des labels courts. Un mot ne se distingue jamais par sa
capitalisation — seulement par sa position spatiale ou son poids.

**Décision tranchée — label « solde »** : éliminé comme exception capitale. Le mot
reste en bas-de-casse, distingué uniquement par sa position au-dessus du montant (pas
de petites capitales, pas d'`uppercase`).

Ne jamais utiliser `text-transform: uppercase`, ne jamais capitaliser pour l'emphase.
