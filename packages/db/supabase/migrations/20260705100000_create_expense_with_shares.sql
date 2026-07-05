-- Étale — insertion atomique dépense + parts figées (spec 4.1/4.3, archi C3-web).
--
-- `security invoker` (PAS definer) : la fonction s'exécute avec les droits de
-- l'appelant, donc la RLS de `expense`/`expense_share` s'applique normalement à
-- l'utilisateur authentifié sur les deux inserts. Un rollback applicatif en 2
-- requêtes (insert dépense puis insert parts, DELETE manuel si échec) risquerait
-- une dépense orpheline sans parts si le DELETE échoue à son tour — la RPC évite
-- cet état incohérent via l'atomicité native de la fonction.

create function public.create_expense_with_shares(
  p_household_id uuid,
  p_label text,
  p_category public.expense_category,
  p_gross_amount_cents integer,
  p_payer_member_id uuid,
  p_incurred_on date,
  p_source text,
  p_created_by uuid,
  p_shares jsonb -- [{"member_id": uuid, "cents": integer, "pct_snapshot": numeric}, ...]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expense_id uuid;
begin
  insert into public.expense (
    household_id, label, category, gross_amount_cents,
    payer_member_id, incurred_on, source, created_by
  )
  values (
    p_household_id, p_label, p_category, p_gross_amount_cents,
    p_payer_member_id, p_incurred_on, p_source, p_created_by
  )
  returning id into v_expense_id;

  insert into public.expense_share (expense_id, member_id, share_cents, share_pct_snapshot)
  select
    v_expense_id,
    (s ->> 'member_id')::uuid,
    (s ->> 'cents')::integer,
    (s ->> 'pct_snapshot')::numeric
  from jsonb_array_elements(p_shares) as s;

  return v_expense_id;
end;
$$;

grant execute on function public.create_expense_with_shares to authenticated;
