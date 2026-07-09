# Intégration dans `apps/web`

Ce fichier traduit le design system (livré en HTML/CSS/JS statique dans le zip) en
plan d'intégration concret pour ce repo. Il ne fait pas foi sur l'architecture logicielle
générale — voir `CLAUDE.md` et `architecture-stack.md` pour ça — seulement sur le
câblage de la partie graphique.

## 1. Où poser les fichiers

`apps/web` est le seul app Next.js déployé (web + `/admin`). Suggestion cohérente avec
la structure existante :

```
apps/web/
  app/
    globals.css          # importe les tokens, remplace/complète l'existant
    fonts/                # next/font/local si binaires copiés localement
  public/
    fonts/                # ou ici, selon la convention next/font choisie
```

Les binaires de polices (`Fraunces-Italic-Variable.ttf`, `GeneralSans-*.woff2`) et le
CSS des tokens (`tokens/*.css`) sont dans le zip source
(`Étale Design System-handoff.zip`, racine du repo) — à extraire et copier lors de
l'implémentation réelle, pas encore fait par ce guide (qui ne contient que la
documentation Markdown demandée).

## 2. Polices — `next/font/local`

Le document de marque impose l'auto-hébergement (pas de CDN). Next.js le fait nativement
via `next/font/local`, ce qui optimise en plus le chargement (`font-display`, aucune
requête réseau tierce) :

```ts
// apps/web/app/fonts.ts
import localFont from "next/font/local";

export const fraunces = localFont({
  src: "./fonts/Fraunces-Italic-Variable.ttf",
  style: "italic",
  variable: "--font-display",
  display: "swap",
});

export const generalSans = localFont({
  src: [
    { path: "./fonts/GeneralSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/GeneralSans-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/GeneralSans-Italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-body",
  display: "swap",
});
```

Puis dans `app/layout.tsx`, appliquer les variables sur `<html>` ou `<body>` :

```tsx
<html lang="fr" className={`${fraunces.variable} ${generalSans.variable}`}>
```

Attention : les tokens `--font-display` / `--font-body` définis dans `tokens/typography.css`
attendent des noms de famille (`"Fraunces Variable"`, `"General Sans"`). Avec
`next/font/local`, ces tokens deviennent inutiles pour la résolution de police — Next
injecte directement la variable CSS générée. Choisir une seule source de vérité (soit
les `@font-face` bruts du zip, soit `next/font/local`) plutôt que les deux en parallèle.

## 3. Tokens CSS — les trois tiers restent la règle

Le principe **primitive → sémantique → composant** du design system rejoint
exactement la règle de dépendance du repo (`calc-engine` / `domain-*` / `db`, ch. 1.4) :
un composant React ne doit jamais lire `--grey-2` directement, seulement
`--surface-raised`. C'est vérifiable à l'œil en review — pas d'outillage ESLint dédié
pour ça côté CSS, contrairement aux imports de packages qui eux sont gardés par
`no-restricted-imports`.

Ordre d'import à respecter (`styles.css` du bundle source) :

```css
@import "tokens/fonts.css";
@import "tokens/colors.css";
@import "tokens/semantic.css";
@import "tokens/typography.css";
@import "tokens/spacing.css";
@import "tokens/radius.css";
@import "tokens/elevation.css";
@import "tokens/motion.css";
@import "tokens/base.css";
```

## 4. Dark mode

`data-theme="dark"` sur `<html>` (ou un ancêtre) bascule les tokens sémantiques — voir
[`02-couleurs.md`](02-couleurs.md). Aucune décision produit sur le déclenchement (auto
via `prefers-color-scheme`, toggle manuel, etc.) n'est fixée par le design system ; à
trancher côté produit si le MVP inclut le dark mode.

## 5. Tailwind, le cas échéant

Le document de marque source (§10, `BRAND_SOURCE.md` du bundle) prescrit, **si**
Tailwind est utilisé : mapper les CSS variables dans `theme.extend`, avec
**suppression explicite des presets par défaut** (couleur, radius, spacing) plutôt que
leur coexistence — c'est ce qui rend l'erreur (retomber dans le générique Tailwind)
plus difficile à commettre que la bonne pratique.

Ce repo n'a pas encore statué sur l'usage de Tailwind dans `apps/web` — vérifier l'état
actuel avant d'appliquer cette section (elle documente l'intention du design system, pas
une décision déjà prise dans `architecture-stack.md`).

## 6. Composants — recréer, pas copier-coller

Les `.jsx` du bundle sont des **prototypes de design** (inline styles, pas de
séparation logique/présentation, pas de gestion d'erreur). Pour `apps/web` :

- Recréer visuellement chaque composant avec les conventions du repo (probablement CSS
  Modules ou classes utilitaires selon ce qui existe déjà dans `apps/web`).
- Consommer uniquement les tokens sémantiques (règle des trois tiers).
- Les Server Actions et la logique métier restent hors composants graphiques —
  `apps/web/app/**/actions.ts` = wrappers fins, aucune logique métier (règle déjà actée
  dans `CLAUDE.md`), donc les composants de ce design system sont purement présentation.
- Pas de TanStack Query (DA9) — l'UI optimiste passe par `useOptimistic`/`useTransition`
  - Server Actions + `revalidatePath/Tag`, ce qui est indépendant de ce design system
    (aucun composant ici ne fait de data-fetching).

## 7. Icônes

`lucide-react` en dépendance npm plutôt que le CDN utilisé dans le prototype
(`unpkg.com/lucide`). `strokeWidth={1.25}` partout où Lucide est utilisé (voir
[`06-iconographie.md`](06-iconographie.md)).
