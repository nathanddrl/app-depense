-- cancel_settlement — annulation/refus d'une régularisation (spec ch.5.3,
-- D16 v0.3, T-C6.3). Transaction unique : passage `pending → cancelled` +
-- dé-stamp (`settlement_id` → null) des dépenses concernées sont atomiques
-- (même précédent que `initiate_settlement`).
--
-- `security invoker` (PAS definer) : la fonction s'exécute avec les droits de
-- l'appelant, donc la RLS de `settlement`/`expense` s'applique normalement.
--
-- La confirmation (`pending → confirmed`) ne touche pas les dépenses (déjà
-- gelées, désormais immuables) : une simple mise à jour de `settlement` suffit,
-- pas besoin de fonction dédiée (atomicité native d'un UPDATE).

create function public.cancel_settlement(p_settlement_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_settlement_id uuid;
begin
  update public.settlement
  set status = 'cancelled', cancelled_at = now()
  where id = p_settlement_id
    and status = 'pending'
  returning id into v_settlement_id;

  if v_settlement_id is null then
    raise exception 'Régularisation introuvable ou déjà traitée.';
  end if;

  update public.expense
  set settlement_id = null
  where settlement_id = v_settlement_id;

  return v_settlement_id;
end;
$$;

grant execute on function public.cancel_settlement to authenticated;
