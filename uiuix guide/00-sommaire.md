# Étale — Guide UI/UX

Guide de référence pour la partie graphique du projet, reconstitué à partir du bundle
**Étale Design System** (export Claude Design, `Étale Design System-handoff.zip`).

**Source unique** : ce design system a été construit à partir d'un seul document
d'identité de marque (reproduit intégralement dans [`01-essence-et-voix.md`](01-essence-et-voix.md))
plus deux polices fournies (Fraunces, General Sans). Aucun code, aucune maquette Figma,
aucun écran produit existant n'a servi de base — il n'y a donc **aucune UI historique à
recréer**. Les tokens et composants documentés ici sont une construction originale des
règles du document de marque, pas la copie d'un produit existant.

**Aucun logo fourni.** Là où une marque graphique irait, le wordmark reste en typo pure
(`étale`, minuscule, Fraunces italique) — le seul signe graphique défini est le "é" isolé
(voir [`06-iconographie.md`](06-iconographie.md)).

## Index

| Fichier | Contenu |
|---|---|
| [01-essence-et-voix.md](01-essence-et-voix.md) | Positionnement produit, personnalité, voix, lexique, contenu interdit |
| [02-couleurs.md](02-couleurs.md) | Palette OKLCH complète (neutres, accent argile, erreurs, dark theme) |
| [03-typographie.md](03-typographie.md) | Fraunces / General Sans, échelle de tailles, règles de casse et de montants |
| [04-espacement-radius-elevation.md](04-espacement-radius-elevation.md) | Échelle d'espacement, radius, élévation, fonds |
| [05-motion.md](05-motion.md) | Les deux paliers d'animation et leurs usages |
| [06-iconographie.md](06-iconographie.md) | Règles Lucide, CategoryChip, interdits absolus |
| [07-composants.md](07-composants.md) | Catalogue des composants (props, comportement, extraits de code) |
| [08-integration-nextjs.md](08-integration-nextjs.md) | Comment câbler tout ça dans `apps/web` (tokens, fonts, dark mode) |
| [09-do-dont.md](09-do-dont.md) | Checklist rapide de conformité DA |

## D'où vient ce guide

Le bundle original (zip Claude Design) contenait, en plus de ces informations : le CSS
des tokens (`tokens/*.css`), les binaires de polices (`assets/fonts/`), le code source
des composants React (`components/**/*.jsx` + `.d.ts` + `.prompt.md`), des cartes de
spécimen HTML (`guidelines/*.card.html`) et un kit d'écrans cliquables
(`ui_kits/app/` : Home, Movements, AddExpense, Settings, AppShell). Ce guide en extrait
et reformule l'essentiel en Markdown ; si une valeur exacte manque ici (un extrait de
CSS, un `.jsx` complet), le zip source fait foi — il est conservé à la racine du repo
(`Étale Design System-handoff.zip`).

## Règle la plus importante du système

**Trois tiers stricts de tokens : primitive → sémantique → composant.** Un composant ne
consomme jamais une primitive (`--grey-2`) directement, seulement un alias sémantique
(`--surface-raised`). C'est la règle unique qui empêche la dérive vers l'app générique
au fil du temps — elle est répétée dans plusieurs fichiers de ce guide car c'est le
principe qui a le plus de valeur à long terme.
