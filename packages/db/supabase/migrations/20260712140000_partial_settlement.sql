-- Règlement partiel et facultatif (spec ch.5.3, D7 révisé, D15 révisé).
--
-- Modèle ledger : le solde n'est plus obtenu en gelant un sous-ensemble de
-- dépenses (impossible à faire proprement pour un montant partiel, sac-à-dos
-- arbitraire) mais en recalculant dynamiquement
-- `Σ contributions des dépenses actives − Σ ajustements des règlements confirmés`
-- (@app/calc-engine.computeBalance). `initiate_settlement`/`cancel_settlement`
-- ne touchaient qu'à `settlement` pour le statut/montant et à `expense` pour le
-- gel/dé-gel ; ce dernier n'a plus lieu d'être, donc plus besoin de RPC
-- transactionnelle multi-tables — `SupabaseSettlementRepository` passe
-- désormais par des `.insert()`/`.update()` directs sur `settlement` seule
-- (même pattern que `confirmSettlement`, déjà un simple UPDATE atomique).
--
-- L'unicité "un seul règlement pending par foyer" (D16) reste garantie par
-- l'index unique partiel `settlement_one_pending_per_household`, créé dans
-- `20260705110000_initiate_settlement.sql` — inchangé ici.
--
-- `expense.settlement_id` n'est plus jamais écrite par le nouveau code ; la
-- colonne est conservée en base pour compatibilité avec l'affichage existant
-- (movements-list.tsx, admin-expense-table.tsx) — suppression différée, notée
-- comme dette technique (cf. spec-technique.md, D7 révisé).

drop function public.initiate_settlement(uuid, integer, uuid, uuid, uuid);
drop function public.cancel_settlement(uuid);
