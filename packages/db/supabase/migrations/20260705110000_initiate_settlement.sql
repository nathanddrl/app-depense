-- initiate_settlement — déclenchement d'une régularisation (spec ch.5.3, D16 v0.3,
-- T-C6.2). Transaction unique : insert du settlement `pending` + gel
-- (`settlement_id`) des dépenses ouvertes du foyer sont atomiques (une RPC en 2
-- requêtes séquentielles risquerait un settlement orphelin sans dépenses gelées
-- si la 2e requête échoue, cf. précédent `create_expense_with_shares`).
--
-- `security invoker` (PAS definer) : la fonction s'exécute avec les droits de
-- l'appelant, donc la RLS de `settlement`/`expense` s'applique normalement.

-- Garantit "une seule régularisation pending par foyer" (D16) même sous
-- concurrence : le check applicatif dans `initiateSettlement` (lecture puis
-- insert) n'est pas à lui seul atomique face à deux déclenchements simultanés.
create unique index settlement_one_pending_per_household
  on public.settlement (household_id)
  where status = 'pending';

create function public.initiate_settlement(
  p_household_id uuid,
  p_amount_cents integer,
  p_from_member_id uuid,
  p_to_member_id uuid,
  p_initiated_by uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_settlement_id uuid;
begin
  insert into public.settlement (
    household_id, amount_cents, from_member_id, to_member_id, initiated_by
  )
  values (
    p_household_id, p_amount_cents, p_from_member_id, p_to_member_id, p_initiated_by
  )
  returning id into v_settlement_id;

  update public.expense
  set settlement_id = v_settlement_id
  where household_id = p_household_id
    and deleted_at is null
    and settlement_id is null;

  return v_settlement_id;
end;
$$;

grant execute on function public.initiate_settlement to authenticated;
