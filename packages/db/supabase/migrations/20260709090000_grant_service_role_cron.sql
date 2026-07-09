-- Étale — GRANT ciblés `service_role` pour le chemin cron réel (spec ch.5.4,
-- T-C7.4). Bug découvert le 09/07/2026 (T-CR3, decisions-techniques.md) :
-- `service_role` a `rolbypassrls = true` (contourne la RLS) mais aucune
-- migration ne lui accordait jamais de privilège de table — ce sont deux
-- systèmes d'autorisation distincts en Postgres, `bypassrls` ne dispense pas
-- des GRANT. Résultat : le Route Handler cron (`/api/cron/recurring`)
-- échouait dès qu'il touchait la base réelle (« permission denied for table
-- recurring_template »), invisible en test car `cron-recurring.test.ts`
-- n'exerce que des fakes (jamais le vrai chemin `service_role`).
--
-- Portée = strictement les tables touchées par le chemin cron
-- (`runRecurringGeneration` → `listActiveTemplatesForGeneration` +
-- `generateOccurrence`), principe du moindre privilège — écarté :
-- `grant ... on all tables in schema public to service_role` (accès total
-- non justifié, cf. arbitrage du 09/07 dans decisions-techniques.md).
--
-- - `recurring_template` / `recurring_aid` : lues directement par le
--   repository (`listActiveTemplatesForGeneration`, hors RPC) → select seul,
--   jamais écrites côté cron.
-- - `recurring_occurrence` / `expense` / `expense_share` / `aid` : touchées
--   par la RPC `generate_recurring_occurrence`, qui est `security invoker`
--   (PAS definer — migration 20260705130000) : elle s'exécute donc avec les
--   droits de l'appelant (`service_role` côté cron), qui a besoin des mêmes
--   GRANT que s'il faisait ces requêtes directement. `security invoker` +
--   `rolbypassrls=true` s'additionnent : la RLS est contournée, mais les
--   GRANT restent requis, deux couches indépendantes.
-- - `expense`/`recurring_occurrence` ont aussi besoin de `select` en plus de
--   `insert` : leurs `insert ... returning id` (dans la RPC) sont traités par
--   Postgres comme une lecture des colonnes retournées, distincte du droit
--   d'écrire la ligne — vérifié en local (`permission denied for table
--   expense`, hint explicite « GRANT SELECT ON public.expense » malgré
--   `insert` déjà accordé).
grant select on public.recurring_template to service_role;
grant select on public.recurring_aid to service_role;
grant select, insert on public.recurring_occurrence to service_role;
grant select, insert on public.expense to service_role;
grant insert on public.expense_share to service_role;
grant insert on public.aid to service_role;
