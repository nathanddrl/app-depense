import { defineConfig, mergeConfig, configDefaults } from "vitest/config";
import base from "../config/vitest.base";

// Config unit par défaut de @app/db. Exclut la suite d'intégration RLS
// (*.rls.test.ts) qui exige Docker + `supabase start` — elle se lance via
// `pnpm --filter @app/db test:rls`. Ainsi `pnpm test` reste vert sans Docker.
export default mergeConfig(
  base,
  defineConfig({
    test: {
      exclude: [...configDefaults.exclude, "**/*.rls.test.ts"],
    },
  }),
);
