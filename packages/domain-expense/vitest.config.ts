// Config Vitest de @app/domain-expense : réexporte la base partagée (archi ch.1.5).
// Les tests d'orchestration tournent avec un FakeExpenseRepository en mémoire —
// aucun Docker/Supabase requis (DA11, tests légers). Le vrai insert + RLS chemin
// réel sera couvert par un test d'intégration gaté côté @app/db (post-C2.5).
export { default } from "../config/vitest.base";
