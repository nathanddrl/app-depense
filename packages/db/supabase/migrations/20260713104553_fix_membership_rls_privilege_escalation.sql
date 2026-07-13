-- Corrige C1 (audit sécurité 2026-07-13) : la policy membership_member_access
-- autorisait tout membre authentifié du foyer à écrire sur `membership`
-- (INSERT/UPDATE/DELETE), y compris modifier sa propre ligne `role` vers
-- 'admin' via un appel Supabase direct depuis le navigateur, en contournant
-- les Server Actions et `requireAdmin()`.
--
-- Aucun code de packages/db/src n'écrit sur `membership` aujourd'hui
-- (vérifié : seuls des .select("member_id") existent, bootstrap manuel D17).
-- On ferme donc totalement l'écriture en RLS plutôt que de la restreindre
-- à un rôle applicatif inexistant.
--
-- Condition de réouverture future : le jour où un flux d'invitation/gestion
-- des membres est livré, ajouter une policy d'écriture avec un `with check`
-- qui vérifie explicitement private.is_household_admin(household_id) (à créer,
-- security definer) — jamais une simple appartenance au foyer.

drop policy membership_member_access on membership;

create policy membership_read on membership
  for select to authenticated
  using (private.is_household_member(household_id));
