import base from "../config/eslint.base.mjs";

// Garde couche feuille db (archi ch.1.4) : db n'importe aucun domain-*.
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
              group: ["@app/domain-*"],
              message: "db est une couche feuille : aucun import de domain-* (archi ch.1.4).",
            },
          ],
        },
      ],
    },
  },
];
