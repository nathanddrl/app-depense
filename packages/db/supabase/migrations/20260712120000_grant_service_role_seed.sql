-- Étale — GRANT ciblés `service_role` pour le chemin du seed réaliste de terrain
-- (apps/web/scripts/seed-realistic.ts). Même précédent que
-- 20260709090000_grant_service_role_cron.sql : `rolbypassrls = true` contourne
-- la RLS mais ne dispense jamais des GRANT de table, deux systèmes distincts.
--
-- Portée = tables touchées par les repos `@app/db` que le script de seed
-- orchestre via les VRAIS domain-* (createExpense, addAid, initiateSettlement/
-- confirmSettlement/cancelSettlement, createRecurringTemplate/
-- updateRecurringTemplate/deactivateRecurringTemplate), principe du moindre
-- privilège — même arbitrage que la migration précédente, écarté :
-- `grant ... on all tables in schema public to service_role`.
--
-- - `membership`/`member` : lus par `getHouseholdMemberIds` (validation
--   contextuelle) et par le résumé du script → select seul.
-- - `expense` : select+insert déjà accordés (migration cron) ; ajoute `update`
--   pour le gel/dégel des dépenses par `initiate_settlement`/`cancel_settlement`
--   (RPC `security invoker`, mêmes UPDATE que ferait l'appelant directement).
-- - `expense_share` : insert déjà accordé ; ajoute `select` (relecture après
--   écriture, `getExpenseById`/`getExpenseForAid`) et `delete` (`addAid`
--   réécrit systématiquement les parts figées via delete+insert, jamais
--   d'update en place).
-- - `aid` : insert déjà accordé ; ajoute `select` (relecture après écriture).
-- - `settlement` : select+insert+update — cycle complet déclenchement/
--   confirmation/annulation, RPC `initiate_settlement`/`cancel_settlement`
--   (`returning id` exige `select`, même piège déjà documenté pour `expense`)
--   + simple UPDATE pour `confirmSettlement`.
-- - `recurring_template`/`recurring_aid` : select déjà accordé (lecture cron) ;
--   ajoute `insert`/`update` sur `recurring_template` (création/édition/
--   désactivation de templates par le seed) et `insert` sur `recurring_aid`
--   (aides récurrentes créées avec le template).
grant select on public.membership to service_role;
grant select on public.member to service_role;
grant update on public.expense to service_role;
grant select, delete on public.expense_share to service_role;
grant select on public.aid to service_role;
grant select, insert, update on public.settlement to service_role;
grant insert, update on public.recurring_template to service_role;
grant insert on public.recurring_aid to service_role;
