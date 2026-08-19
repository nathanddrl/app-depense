import { defineConfig, mergeConfig, configDefaults } from "vitest/config";
import base from "../../packages/config/vitest.base";

// Tests unitaires par défaut : la suite d'intégration `*.rls.test.ts` (Docker/
// Supabase requis) est EXCLUE — même gate que @app/db, `pnpm test` reste vert.
export default mergeConfig(
  base,
  defineConfig({
    // `tsconfig.json` fixe `jsx: "preserve"` pour la transformation Next/SWC —
    // le transform Vite (oxc, Vite 8) hérite de ce réglage et échoue sur tout
    // `.tsx` important du JSX réel. Override local, sans effet sur le build
    // Next (config Vite distincte) : nécessaire pour monter un composant en test.
    oxc: {
      jsx: { runtime: "automatic" },
    },
    test: {
      exclude: [...configDefaults.exclude, "**/*.rls.test.ts"],
    },
  }),
);
