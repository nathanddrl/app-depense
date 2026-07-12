# Étale

App web de gestion de dépenses partagées d'un foyer. Monolithe modulaire dans
un monorepo pnpm (Next.js App Router + packages `domain-*` + `calc-engine`).

## Prérequis

- Node ≥ 22, [pnpm](https://pnpm.io/)
- Docker (Supabase local tourne dans des containers)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)

## Démarrage

```bash
pnpm install

# Démarre Postgres/Auth/API en local (Docker) + applique les migrations
pnpm --filter @app/db db:start

# Copie le fichier d'exemple et complète NEXT_PUBLIC_SUPABASE_ANON_KEY
cp apps/web/.env.example apps/web/.env.local
supabase status --workdir packages/db   # affiche la clé anon locale

pnpm --filter @app/web dev
```

Ouvre `http://localhost:3000`.

Pour repartir d'une base propre (migrations + seed de test) :

```bash
pnpm --filter @app/db db:reset
```

## Comptes de test (seed)

Foyer « Maison », deux membres, répartition 50/50 :

| Email                | Mot de passe      | Membre         |
| :------------------- | :---------------- | :------------- |
| `nathan@etale.local` | `password-nathan` | Nathan (admin) |
| `copine@etale.local` | `password-copine` | Oksana         |

Connecte-toi avec deux navigateurs (ou une fenêtre privée) pour tester les
échanges entre les deux comptes (régularisation notamment).

## Fonctionnalités

- Ajout d'une dépense ponctuelle (catégorie, montant, répartition en %)
- Aides rattachées à une dépense (ex. APL), déduites avant répartition
- Solde entre les deux membres, avec détail dépliable
- Régularisation à double approbation (le débiteur déclenche, le créancier
  confirme ou annule) — verrouille les dépenses concernées
- Génération mensuelle automatique des dépenses récurrentes (loyer, etc.),
  déclenchée par un cron (pas d'interface dédiée pour l'instant — le seed crée
  un template « Loyer 800€ jour 5 + APL 200€ », visible/modifiable seulement en
  base ou via Studio)

## Seed réaliste de terrain (6 mois glissants)

Le seed de base (`db:reset`) crée juste les comptes, le foyer et un template
loyer. Pour un jeu de données crédible côté produit (test utilisateur, démo),
un second script ajoute par-dessus 6 mois d'historique glissant : dépenses
récurrentes (loyer + assurance + un abonnement `day_of_month=31` pour exposer
le clamp de fin de mois), une dizaine de dépenses ponctuelles variées, des
aides (dont un cas de plafonnement et un split « les deux »), et trois cycles
de régularisation (confirmé, annulé, pending) :

```bash
pnpm --filter @app/db db:reset          # base propre + seed de base
pnpm --filter @app/web seed:realistic   # ajoute la couche réaliste 6 mois
```

Le script (`apps/web/scripts/seed-realistic.ts`) orchestre les vrais
`domain-*` (jamais d'insert SQL à la main pour la logique métier) et affiche
un résumé en fin d'exécution (dépenses par mois, templates, régularisations,
solde net). Rejouable à volonté après un `db:reset`.

## Tester la génération récurrente manuellement

Pas de bouton dans l'UI : deux façons de la déclencher toi-même.

**Route cron**, en complétant `SUPABASE_SERVICE_ROLE_KEY` et `CRON_SECRET`
dans `apps/web/.env.local` puis en relançant `pnpm --filter @app/web dev` :

```bash
curl -H "Authorization: Bearer <valeur de CRON_SECRET>" http://localhost:3000/api/cron/recurring
```

Réponse : `{"generated":1,"skipped":0,"failed":0}` (puis `generated:0,skipped:1`
si rejouée dans le même mois — idempotence). La dépense générée apparaît dans
l'historique et le solde, éditable normalement.

**Script Node ponctuel**, en pointant la base locale avec une clé service_role :

```ts
import { createDbClient, SupabaseRecurringTemplateRepository } from "@app/db";
import { runRecurringGeneration } from "@app/domain-recurrence";

const supabase = createDbClient("http://127.0.0.1:54521", "<service_role_key>");
const repo = new SupabaseRecurringTemplateRepository(supabase);
console.log(await runRecurringGeneration(repo));
```

## Commandes

| Commande                                | Effet                                           |
| :-------------------------------------- | :---------------------------------------------- |
| `pnpm build`                            | `turbo run build` → `next build` sur `apps/web` |
| `pnpm test`                             | Tests de tout le monorepo (Vitest par package)  |
| `pnpm lint` / `pnpm typecheck`          | ESLint / `tsc --noEmit` par package             |
| `pnpm format` / `pnpm format:check`     | Prettier                                        |
| `pnpm --filter @app/db db:stop`         | Arrête Supabase local                           |
| `supabase status --workdir packages/db` | Réaffiche URL/clés Supabase locales             |

## Ports Supabase locaux

| Service                           | URL                      |
| :-------------------------------- | :----------------------- |
| API                               | `http://127.0.0.1:54521` |
| Studio (interface web des tables) | `http://127.0.0.1:54523` |

## Architecture

Document de référence complet :
`CLAUDEOS/05_Dev/App Depense/App Depense Resources/architecture-stack.md`.

```
apps/web/              Next.js App Router — seul app déployé
packages/
  calc-engine/         Seule source de vérité du calcul (parts, solde)
  domain-expense/       Dépenses ponctuelles
  domain-aid/            Aides
  domain-settlement/     Régularisation double approbation
  domain-recurrence/     Templates récurrents + génération mensuelle
  db/                    Schéma Supabase, migrations, client typé
  shared/                ActionResult/AppError, formatage, validations
  config/                tsconfig/eslint/prettier/vitest partagés
```
