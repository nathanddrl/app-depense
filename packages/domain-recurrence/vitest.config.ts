// Config Vitest de @app/domain-recurrence : réexporte la base partagée (archi ch.1.5).
// Les tests d'orchestration tournent avec un FakeRecurringTemplateRepository en
// mémoire — aucun Docker/Supabase requis (DA11, tests légers).
export { default } from "../config/vitest.base";
