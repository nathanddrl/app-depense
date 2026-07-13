# Icônes PWA Étale — prêtes à intégrer

Générées le 13/07/2026 à partir de `etale-images/ios/*.png` (export identique pixel pour pixel entre `ios/` et `android/` — même artwork, vérifié par hash).

## Fichiers et destination dans le repo de code

| Fichier ici | Destination (`apps/web/`) | Usage |
| :---- | :---- | :---- |
| `icon-192.png` | `public/icons/icon-192.png` | manifest, icône standard |
| `icon-512.png` | `public/icons/icon-512.png` | manifest, icône standard |
| `icon-192-maskable.png` | `public/icons/icon-192-maskable.png` | manifest, `purpose: "maskable"` |
| `icon-512-maskable.png` | `public/icons/icon-512-maskable.png` | manifest, `purpose: "maskable"` |
| `apple-touch-icon.png` | `public/icons/apple-touch-icon.png` | iOS, taille 180×180 (T-CP1.3) |
| `favicon-32.png` | `app/icon.png` (renommer) ou `public/favicon.ico` (convertir) | favicon navigateur |

## Vérifications faites ici (géométrie et couleur, pas de rendu réel navigateur/OS)

- **Maskable** : contenu du logo mesuré à 34,8 % du rayon max depuis le centre — sous le seuil de 40 % (zone de sécurité maskable), fond opaque plein cadre. Les fichiers `-maskable` sont donc des copies directes des icônes standards (pas de retravail nécessaire), mais **le rendu réel dans l'aperçu d'installation Android reste à vérifier** (DoD T-CP1.2), pas juste supposé sur la base du calcul géométrique.
- **Transparence** : alpha à 255 partout (aucune vraie transparence) — pas de risque de fond noir sur iOS.
- **Couleurs proposées pour le manifest**, dérivées des tokens réels de `uiuix guide/02-couleurs.md` (pas une couleur arbitraire de l'export) :
  - `background_color` : `#eef8f4` — correspond exactement à `--grey-0` (`oklch(0.97 0.012 170)`, rôle "fond"). Confirmé par calcul de conversion OKLCH→sRGB ET par la couleur de fond mesurée sur les PNG fournis (`238,248,244`) — les deux coïncident au pixel près.
  - `theme_color` : `#16221d` — dérivé de `--grey-6` (`oklch(0.24 0.02 168)`, rôle "texte primaire"), très proche de l'encre du logo mesurée sur les PNG (`~#182018`). Cohérent mais pas identique pixel pour pixel — **à valider par Nathan** avant de figer en dur dans `manifest.ts` (aucun token `--theme-color` explicite n'existe dans le design system, ceci est une déduction).

## Reste hors scope de cette livraison

- Le dossier `windows/` (tuiles UWP) n'a pas été traité : PC-3 ne cible pas Windows/UWP.
- Splash iOS graphiques (au-delà des meta tags `theme-color`/`apple-mobile-web-app-*`) : non couverts, T-CP1.3 ne les exige pas comme fichiers.
- Intégration effective dans le repo de code (copie des fichiers, écriture de `manifest.ts`) : à faire via Claude Code (T-CP1.1 → T-CP1.4), pas depuis Cowork qui n'a pas accès au repo.
