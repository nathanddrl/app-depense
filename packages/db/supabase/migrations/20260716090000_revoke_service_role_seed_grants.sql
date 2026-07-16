-- Étale — révoque les GRANT `service_role` accordés par
-- 20260712120000_grant_service_role_seed.sql (audit résidus prod, 16/07/2026).
--
-- Contexte : ce monorepo pousse le MÊME historique de migrations vers
-- etale-prod et etale-dev (`supabase db push`) — rien ne permet d'exclure une
-- migration de l'un ou l'autre. La migration seed ci-dessus accordait des
-- droits `service_role` pensés pour `apps/web/scripts/seed-realistic.ts`
-- (script LOCAL uniquement, jamais exécuté en prod), mais elle atterrissait
-- telle quelle en prod où ces droits n'ont structurellement aucune raison
-- d'exister (principe du moindre privilège, même logique que l'arbitrage
-- documenté dans 20260709090000_grant_service_role_cron.sql).
--
-- Les GRANT nécessaires au seed local sont désormais dans
-- `packages/db/supabase/seed.sql`, qui n'est JAMAIS poussé par `db push` —
-- seulement rejoué localement par `supabase db reset`.
--
-- REVOKE ciblé, un par privilège ajouté par la migration seed — ne touche pas
-- aux GRANT du chemin cron réel (20260709090000), strictement disjoints ou
-- couverts par des privilèges différents sur les mêmes tables.
revoke select on public.membership from service_role;
revoke select on public.member from service_role;
revoke update on public.expense from service_role;
revoke select, delete on public.expense_share from service_role;
revoke select on public.aid from service_role;
revoke select, insert, update on public.settlement from service_role;
revoke insert, update on public.recurring_template from service_role;
revoke insert on public.recurring_aid from service_role;
