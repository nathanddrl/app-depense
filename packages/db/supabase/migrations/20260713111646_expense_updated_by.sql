-- Traçabilité minimale des corrections admin post-régularisation (audit sécurité
-- M3, 2026-07-13). `adminUpdateExpense` (packages/domain-expense) contourne
-- délibérément le verrou EXPENSE_LOCKED (DA-OPEN1, choix produit assumé) mais
-- ne laissait aucune trace exploitable au-delà d'un `updated_at` jamais patché
-- (aucun trigger, aucun call site ne l'écrivait). `updated_at` existe déjà
-- (init_schema) ; seule `updated_by` manque pour savoir QUI a fait la correction.
alter table expense add column updated_by uuid references member (id);
