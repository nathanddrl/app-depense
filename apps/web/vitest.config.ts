import { defineConfig, mergeConfig, configDefaults } from "vitest/config";
import base from "../../packages/config/vitest.base";

// Tests unitaires par défaut : la suite d'intégration `*.rls.test.ts` (Docker/
// Supabase requis) est EXCLUE — même gate que @app/db, `pnpm test` reste vert.
export default mergeConfig(
  base,
  defineConfig({
    test: {
      exclude: [...configDefaults.exclude, "**/*.rls.test.ts"],
    },
  }),
);
