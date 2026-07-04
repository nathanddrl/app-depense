// Point d'entrée Vitest à la racine (archi ch.3.3 / DA11).
// La configuration réelle est partagée depuis packages/config ; chaque package
// l'exécute via Turbo (`turbo run test --filter=@app/<pkg>`).
export { default } from "./packages/config/vitest.base";
