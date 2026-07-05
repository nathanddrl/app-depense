import base from "../config/eslint.base.mjs";

// Garde de dépendance de domain-settlement (archi ch.1.4 / DA4) : un domaine peut
// importer calc-engine, shared et db, mais JAMAIS un autre domain-*. Le
// `files: **/*.ts` sans préfixe de chemin rend la règle indépendante du
// répertoire d'où ESLint est lancé (miroir de la garde domain-aid).
export default [
  ...base,
  {
    files: ["**/*.ts"],
    rules: {
      // On redéfinit `no-restricted-imports` (le flat config remplace la règle de
      // base au lieu de la fusionner) : on RÉ-INCLUT donc la garde « API publique »
      // de la base, en plus de la garde anti-cross-domaine.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@app/*/src/*", "@app/*/src/**"],
              message:
                "Importer uniquement l'API publique d'un package (@app/x), jamais un fichier interne (archi ch.1.4).",
            },
            {
              group: ["@app/domain-aid", "@app/domain-expense", "@app/domain-recurrence"],
              message:
                "Un domaine n'importe jamais un autre domain-* (archi ch.1.4, DA4). Passe par calc-engine/shared/db.",
            },
          ],
        },
      ],
    },
  },
];
