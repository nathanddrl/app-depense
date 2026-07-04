import { defineConfig } from "vitest/config";

// Base Vitest partagée par tous les packages.
// `passWithNoTests` : indispensable tant que les packages sont vides — sans lui,
// `vitest run` sort en code 1 quand il ne trouve aucun fichier de test.
export default defineConfig({
  test: {
    environment: "node",
    passWithNoTests: true,
  },
});
