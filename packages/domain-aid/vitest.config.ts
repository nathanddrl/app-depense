// Config Vitest de @app/domain-aid : réexporte la base partagée (archi ch.1.5).
// Les tests d'orchestration tournent avec un FakeAidRepository en mémoire —
// aucun Docker/Supabase requis (DA11, tests légers).
export { default } from "../config/vitest.base";
