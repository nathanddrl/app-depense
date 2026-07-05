-- Étale — génération idempotente d'une occurrence récurrente (spec ch.5.4, T-C7.2).
--
-- `security invoker` (comme `create_expense_with_shares`) : la RLS de `expense`/
-- `expense_share`/`aid`/`recurring_occurrence` s'applique normalement à l'appelant
-- (service role côté cron T-C7.4, hors scope ici).
--
-- Idempotence GARANTIE par la contrainte `unique (template_id, period)` sur
-- `recurring_occurrence`, PAS par une vérification applicative : le pré-check
-- `exists (...)` ci-dessous n'est qu'une optimisation pour éviter un insert
-- inutile ; en cas de course concurrente, l'insert final dans
-- `recurring_occurrence` échoue sur la contrainte unique, ce qui fait échouer
-- (et donc annule intégralement, atomicité native de la fonction) l'insert de
-- la dépense/parts/aides déjà effectué dans le même appel — jamais de dépense
-- orpheline.
create function public.generate_recurring_occurrence(
  p_template_id uuid,
  p_period date,
  p_household_id uuid,
  p_label text,
  p_category public.expense_category,
  p_gross_amount_cents integer,
  p_payer_member_id uuid,
  p_incurred_on date,
  p_shares jsonb, -- [{"member_id": uuid, "cents": integer, "pct_snapshot": numeric}, ...]
  p_aids jsonb -- [{"beneficiary_member_id": uuid, "label": text, "amount_cents": integer}, ...]
)
returns jsonb -- {"occurrence_id": uuid, "expense_id": uuid}, ou null si déjà générée (no-op)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expense_id uuid;
  v_occurrence_id uuid;
begin
  if exists (
    select 1
    from public.recurring_occurrence
    where template_id = p_template_id
      and period = p_period
  ) then
    return null;
  end if;

  insert into public.expense (
    household_id, label, category, gross_amount_cents,
    payer_member_id, incurred_on, source
  )
  values (
    p_household_id, p_label, p_category, p_gross_amount_cents,
    p_payer_member_id, p_incurred_on, 'recurring'
  )
  returning id into v_expense_id;

  insert into public.expense_share (expense_id, member_id, share_cents, share_pct_snapshot)
  select
    v_expense_id,
    (s ->> 'member_id')::uuid,
    (s ->> 'cents')::integer,
    (s ->> 'pct_snapshot')::numeric
  from jsonb_array_elements(p_shares) as s;

  insert into public.aid (expense_id, beneficiary_member_id, label, amount_cents)
  select
    v_expense_id,
    (a ->> 'beneficiary_member_id')::uuid,
    a ->> 'label',
    (a ->> 'amount_cents')::integer
  from jsonb_array_elements(p_aids) as a;

  insert into public.recurring_occurrence (template_id, period, expense_id)
  values (p_template_id, p_period, v_expense_id)
  returning id into v_occurrence_id;

  return jsonb_build_object('occurrence_id', v_occurrence_id, 'expense_id', v_expense_id);
end;
$$;

grant execute on function public.generate_recurring_occurrence to authenticated;
