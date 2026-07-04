import base from "../config/eslint.base.mjs";

// Garde de pureté calc-engine (archi ch.1.4 / DA4) : ce package n'importe RIEN
// des domain-* ni de db. Le `files: **/*.ts` sans préfixe de chemin rend la
// règle indépendante du répertoire d'où ESLint est lancé.
export default [
  ...base,
  {
    files: ["**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@app/domain-*", "@app/db"],
              message:
                "calc-engine doit rester pur : aucun import de domain-* ni de db (archi ch.1.4, DA4).",
            },
          ],
        },
      ],
    },
  },
];
