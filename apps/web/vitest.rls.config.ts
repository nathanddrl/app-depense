import { defineConfig, mergeConfig } from "vitest/config";
import base from "../../packages/config/vitest.base";

// Suite d'intégration gatée (Docker/Supabase local requis) : lancée via
// `pnpm --filter @app/web test:rls`, hors `pnpm test` par défaut.
export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ["**/*.rls.test.ts"],
      testTimeout: 20000,
      hookTimeout: 30000,
      fileParallelism: false,
    },
  }),
);
