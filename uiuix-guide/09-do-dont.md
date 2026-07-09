# Checklist rapide — do / don't

| Faire                                                                      | Ne pas faire                                                                   |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Consommer les tokens sémantiques (`--surface-raised`)                      | Consommer une primitive directement (`--grey-2`) dans un composant             |
| Encoder l'écart via la magnitude de `WaterLine` (ligne + une seule teinte) | Utiliser un badge/pill coloré ou deux teintes opposées pour « les deux côtés » |
| Utiliser `radius-subtle` (2px) uniquement sur inputs/surfaces tactiles     | Arrondir des cards, boutons, dialogs, chips                                    |
| Utiliser `--elevation-*` (luminosité de surface) pour la profondeur        | Ajouter un `box-shadow` où que ce soit, y compris les modals                   |
| Fraunces italique uniquement pour les constats déclaratifs                 | Utiliser Fraunces romain, ou Fraunces pour un titre/label                      |
| Chiffres tabulaires, montants différenciés par le poids                    | Faire varier la taille de police d'un montant pour l'emphase                   |
| `motion.settle` / `motion.micro` (décélération lourde, zéro overshoot)     | Ajouter un easing spring/bounce n'importe où                                   |
| Auto-assigner la couleur/l'initiale d'une catégorie                        | Exposer un color picker pour les catégories                                    |
| Isoler `color.system.error` de `color.balance.*`                           | Réutiliser un token de l'échelle de balance pour une erreur technique          |
| Nommer les personnes dans la copy (« léa doit 42 € à nathan »)             | Utiliser une formulation impersonnelle (« l'écart est en faveur de x »)        |
| Rester en bas-de-casse, y compris le nom de marque                         | `text-transform: uppercase`, capitaliser pour l'emphase                        |
| Un ton factuel, déclaratif, présent                                        | Un impératif, un point d'exclamation, une célébration ou un blâme              |

## Interdits absolus — contenu

Bravo, félicitations, n'oubliez pas, relancez, en retard, objectif, économiser,
optimisez, oups. Aucun emoji, aucun `!`, jamais.

## Interdits absolus — iconographie / imagerie

Pièces, billets, cartes bancaires, portefeuilles, tirelires, personnages/avatars, mains
qui se serrent, blobs mignons, émojis vectorisés, flèches de tendance boursière,
confettis, badges/streaks. Pas de style photo/illustration inventé sans validation.

## Anti-marque — jamais

Badges, streaks, félicitations (réflexe Tricount) · vocabulaire de pilotage/contrôle
(« optimiser », « objectif », réflexe fintech) · urgence ou culpabilisation
(« retard », « rappel ») · mascotte, personnification cute · comparaison sociale entre
couples · moralisation des habitudes de dépense · surveillance déguisée en insight
(« on a remarqué que... »).

## Le test en une phrase

Avant de valider un écran ou une copy : **est-ce que ça pousse à ouvrir l'app plus
souvent, ou à s'en inquiéter davantage ?** Si oui, ce n'est pas Étale — le produit
gagne quand il y a le moins de raisons possibles de revenir dessus.
