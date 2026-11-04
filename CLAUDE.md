# CLAUDE.md — Étale

App web de gestion de dépenses partagées d'un foyer. **Solo dev, MVP.** Monolithe
modulaire dans un monorepo pnpm. Document d'architecture de référence :
`CLAUDEOS/05_Dev/App Depense/App Depense Resources/architecture-stack.md` (fait foi ;
décisions numérotées DA1-DA14 et D1-D18).

## Conventions de travail

- **Jamais de co-author Claude / Claude Code dans les commits.** Aucune ligne
  `Co-Authored-By: Claude…`, aucune mention « Generated with Claude Code ».
- Répondre et commenter le code en français.

## Structure (archi ch.1.3)

```
apps/web/              Next.js App Router — seul app déployé (web + admin /admin, ch.4)
packages/
  calc-engine/         SEULE source de vérité du calcul. Fonctions pures, zéro I/O.
  domain-expense/      Orchestration dépenses ponctuelles (spec ch.5.1)
  domain-aid/          Orchestration aides (ch.5.2)
  domain-settlement/   Régularisation double approbation (ch.5.3)
  domain-recurrence/   Templates/occurrences, appelé par le cron (ch.5.4)
  db/                  Schéma Supabase, migrations, client typé (couche feuille)
  shared/              ActionResult/AppError, enums, formatAmountEUR/formatDateFr (DA10)
  config/              tsconfig/eslint/prettier/vitest partagés (jamais importé au runtime)
```

## Règle de dépendance — NON NÉGOCIABLE (archi ch.1.4 / DA4)

- `calc-engine` n'importe **rien** des `domain-*` ni de `db` (pur, testable isolément).
- Les `domain-*` peuvent importer `calc-engine` et `shared`, **jamais** se réimplémenter.
- `db` est une feuille : n'importe aucun `domain-*`.
- On importe uniquement l'API publique d'un package (`@app/x`), jamais un fichier
  interne (`@app/x/src/...`).
- Ces règles sont **gardées par ESLint** (`no-restricted-imports`) : configs locales
  dans `packages/calc-engine/eslint.config.mjs` et `packages/db/eslint.config.mjs`,
  garde « API publique » dans `packages/config/eslint.base.mjs`. Un import interdit
  fait échouer `pnpm lint`.

## Résolution cross-package — source-exports (archi ch.1.5 / DA5)

Chaque package expose sa source directement : `"exports": { ".": "./src/index.ts" }`

- `"types": "./src/index.ts"`. **Pas de build de package, pas de `.d.ts`, pas de TS
  project references.** `moduleResolution: "bundler"` lit `exports` → jump-to-definition
  vers la vraie source. Next les transpile via `transpilePackages` (7 packages runtime,
  `config` exclu) ; Vitest via esbuild. Ne jamais ajouter de section `paths` dans un
  tsconfig — la seule source de vérité est le champ `exports`.

## Commandes

| Commande                              | Effet                                                     |
| :------------------------------------ | :-------------------------------------------------------- |
| `pnpm build`                          | `turbo run build` → `next build` sur `apps/web`           |
| `pnpm test`                           | `turbo run test` → Vitest par package (`passWithNoTests`) |
| `pnpm test --filter=@app/calc-engine` | Scope un package (via turbo)                              |
| `pnpm lint` / `pnpm typecheck`        | ESLint / `tsc --noEmit` par package                       |
| `pnpm format` / `pnpm format:check`   | Prettier                                                  |

## Design Context

`apps/web/PRODUCT.md` (registre, utilisateurs, positionnement, anti-références)
et `apps/web/DESIGN.md` (tokens couleur/typo/motion, composants, do's/don'ts)
font foi pour tout travail UI — générés par `/impeccable init`, à partir du
guide de marque `uiuix-guide/` et des tokens réels (`app/styles/tokens/*.css`).

## Contraintes de stack

- **Ne pas installer** TanStack Query (DA9) ni next-intl (DA10). UI optimiste =
  `useOptimistic`/`useTransition` + Server Actions + `revalidatePath/Tag`.
- Server Actions dans `apps/web/app/**/actions.ts` = wrappers fins (validation →
  appel domain → `ActionResult<T>`), **aucune logique métier**.
- **ESLint reste en v9** (pas v10) : `eslint-plugin-react` (via `eslint-config-next`)
  n'est pas compatible ESLint 10. Vérifier avant tout bump.
- Priorité tests (DA11) : `calc-engine` + RLS en P1, `domain-settlement` en P2.

## Migrations Supabase (prod)

- Les migrations (`packages/db/supabase/migrations/`) sont appliquées sur
  `etale-prod` **automatiquement** au merge sur `main` par
  `.github/workflows/migrate-prod.yml` (aussi lançable à la main via
  `workflow_dispatch`). Plus de `supabase db push` manuel.
- **Vercel déploie `main` en parallèle** de ce workflow : l'ordre migration → code
  n'est pas garanti. Une migration doit donc rester **compatible avec le code déjà
  en ligne** : ajouter avant d'utiliser, retirer après. Concrètement, une colonne,
  table ou fonction nouvelle arrive dans une PR, le code qui s'en sert dans la
  suivante (ou la même si l'ancien code l'ignore sans casser) ; une suppression ou
  un renommage se fait en deux temps (le code cesse de l'utiliser, puis la
  migration la retire).
- La CI (`ci.yml`, job `migrations`) applique toutes les migrations + le seed sur
  un Supabase local et lance `test:rls` sur chaque PR.
