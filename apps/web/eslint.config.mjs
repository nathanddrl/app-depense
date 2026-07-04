import next from "eslint-config-next";
import eslintConfigPrettier from "eslint-config-prettier";

// apps/web utilise sa propre config basée sur eslint-config-next (flat config natif
// en v16 : react, hooks, import, jsx-a11y, @next/next + support TS intégré).
// On ne compose PAS la base typescript-eslint ici, pour ne pas redéclarer le
// plugin @typescript-eslint (déjà fourni par eslint-config-next).
const config = [
  ...next,
  {
    // Garde « API publique uniquement » (archi ch.1.4), identique à la base.
    rules: {
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
];

export default config;
