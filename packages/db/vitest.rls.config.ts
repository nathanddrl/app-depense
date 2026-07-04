import { defineConfig, mergeConfig } from "vitest/config";
import base from "../config/vitest.base";

// Suite d'intégration RLS (DA11, priorité 1) : tourne contre Supabase local.
// N'inclut QUE les *.rls.test.ts. Prérequis : `supabase start` (Docker) et une
// base migrée+seedée (`supabase db reset`). DB partagée → pas de parallélisme.
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
