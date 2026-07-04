import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

/**
 * Base ESLint partagée (flat config) — archi ch.1.4 / DA4.
 *
 * Ne contient QUE des règles indépendantes du package courant :
 *  - qualité de base (js + typescript-eslint recommandé) ;
 *  - garde « API publique uniquement » : interdit d'importer un fichier interne
 *    d'un autre package (`@app/x/src/...`) au lieu de son baril public (`@app/x`).
 *
 * Les gardes spécifiques à un package (pureté de calc-engine, feuille db) vivent
 * dans le `eslint.config.mjs` local du package concerné, pour rester robustes
 * quel que soit le répertoire depuis lequel ESLint est lancé.
 */
export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/.next/**", "**/.turbo/**", "**/dist/**", "**/coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@app/*/src/*", "@app/*/src/**"],
              message:
                "Importer uniquement l'API publique d'un package (@app/x), jamais un fichier interne (archi ch.1.4).",
            },
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
);
