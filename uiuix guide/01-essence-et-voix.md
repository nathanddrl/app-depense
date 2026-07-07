# Essence, personnalité et voix

## 1. Essence

**Étale ne traque pas une dette, elle absorbe l'écart avant qu'il devienne un sujet.**

Le produit ne vend pas une fonction de calcul, il vend un état émotionnel : l'absence de
tension autour de l'argent dans le couple.

**Défendabilité** : les deux pôles concurrents — split événementiel gamifié type
Tricount, fintech perso type Sumeria/Revolut — vivent économiquement de la visibilité et
de l'engagement autour de l'argent. Étale a l'intérêt inverse : plus le produit
fonctionne, moins il y a de raison de l'ouvrir. C'est une position qu'un acteur financé
par la rétention ne peut pas copier sans se saborder.

## 2. Personnalité

Pas d'archétype générique. Étale est un **témoin fiable**, jamais un arbitre. Face à un
écart qui grossit, elle affiche les faits propres (montant, origine) et se retire — elle
ne relance pas, ne colore rien en alerte, ne prend jamais parti.

Deux tensions à tenir en permanence, qui définissent le personnage plus que des
adjectifs :

- **Factuelle sans être indifférente** — voit la charge émotionnelle sans l'exploiter ni
  l'ignorer.
- **Autorité sans paternalisme** — sérieuse sur l'argent réel, mais ne conseille jamais,
  n'éduque jamais, ne pousse aucune « bonne pratique ».

## 3. Voix

Déclarative, présente, factuelle. **Jamais** d'impératif, **jamais** de point
d'exclamation, **jamais** de blâme ni de célébration.

| Situation | Étale dit | Jamais |
|---|---|---|
| Solde équilibré | vous êtes étale | bravo, vos comptes sont à jour ! |
| Écart en cours | léa doit 42 € à nathan | léa te doit de la thune, relance-la 💸 |
| Régularisation | l'écart est résorbé | transaction validée ✅ bien joué ! |
| Dépense récurrente | le loyer de juillet a été ajouté | 🏠 n'oubliez pas de payer avant le 5 ! |
| Écran vide | rien à régler pour l'instant | ajoutez votre première dépense ! 🎉 |
| Écart ancien | l'écart date du 12 juin | ⏰ 21 jours de retard ! |

**Mots bannis** : bravo, félicitations, n'oubliez pas, relancez, en retard, objectif,
économiser, optimisez, oups. **Aucun emoji, aucun point d'exclamation, jamais.**

### Nomination des personnes — décision tranchée

Les prénoms sont utilisés explicitement dans la copy (« léa doit 42 € à nathan »),
**jamais** de formulation impersonnelle (« l'écart est de 42 € en faveur de x »).

Raison : le produit vend un état intime entre deux personnes réelles ; l'impersonnel est
un réflexe de prudence corporate qui refroidit exactement ce qu'on cherche à réchauffer.
La protection d'exposition (écran visible par un tiers) est un sujet de fonctionnalité —
un mode de confidentialité activable à l'écran de verrouillage — pas un sujet qui doit
dicter le ton par défaut.

### Casse

Bas-de-casse quasi systématique, **y compris le nom de marque** (« étale ») et des
labels courts comme « solde ». Capitales bannies partout — un mot ne se distingue jamais
par sa capitalisation, seulement par sa position ou son poids typographique (voir
[`03-typographie.md`](03-typographie.md)). Ne jamais utiliser `text-transform: uppercase`
ni capitaliser pour appuyer une emphase.

### Lexique — « le lexique de la marée »

| Utiliser | Jamais |
|---|---|
| écart | dette / debt |
| résorption | remboursement / repayment |
| mouvement | transaction |

C'est la signature de marque la plus difficile à copier : reprendre un mot isolé ne
coûte rien à un concurrent, reprendre tout le champ lexical revient à abandonner son
propre vocabulaire de conversion.

## 4. Signatures de marque

- **Horizontalité** — le solde est un niveau par rapport à une ligne, jamais un nombre
  dans un cartouche coloré. Encodage littéral de l'équilibre dans la mise en page, pas
  une illustration (voir composant `WaterLine`, [`07-composants.md`](07-composants.md)).
- **L'accent du « é »** — seul trait diagonal toléré dans un système tout en
  horizontales. Isolé, il devient favicon / avatar / motif de marque à part entière —
  jamais dispersé comme motif décoratif générique.
- **Le lexique de la marée** — voir ci-dessus.

## 5. Anti-marque — jamais

Badges, streaks, félicitations (réflexe Tricount) · vocabulaire de pilotage/contrôle,
« optimiser », « objectif » (réflexe fintech) · urgence ou culpabilisation, « retard »,
« rappel » · mascotte, personnification cute · comparaison sociale entre couples ·
moralisation des habitudes de dépense · surveillance déguisée en insight
(« on a remarqué que... »).

## 6. Extension future

L'essence (« absorber l'écart avant qu'il devienne un sujet ») généralise sans effort à
la charge mentale domestique au sens large — tâches, rendez-vous, mental load du foyer.
Le lexique de la marée et l'horizontalité tiennent identiquement sur un « écart » de
tâches.

**Point de vigilance réel** : ne pas figer le vocabulaire produit sur « dépense/solde »
dans le code et l'UI dès le MVP si cette extension est un jour poursuivie — sujet
d'architecture logicielle, pas seulement graphique.

## Règles de contenu pour le code (strings, labels, messages d'erreur)

- Bas-de-casse partout, y compris le nom de marque et les labels (« solde »). Jamais
  `text-transform: uppercase`.
- Déclaratif, présent. Jamais d'impératif, jamais de `!`, jamais de blâme ou de
  célébration.
- Nommer les personnes, pas la relation : `"léa doit 42 € à nathan"`, jamais
  `"l'écart est de 42 € en faveur de x"`.
- Vocabulaire : **écart** (pas dette), **résorption** (pas remboursement),
  **mouvement** (pas transaction).
- Mots bannis : bravo, félicitations, n'oubliez pas, relancez, en retard, objectif,
  économiser, optimisez, oups. Aucun emoji, aucun `!`, jamais.
