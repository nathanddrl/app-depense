-- Historique des modifications d'une dépense (écran « d'où vient l'écart »).
--
-- Le solde est un ledger recalculé en continu : corriger une dépense déjà
-- couverte par un règlement est permis (choix produit : avertir, jamais
-- bloquer). Pour expliquer ensuite ce qui a bougé, il faut pouvoir rejouer la
-- dépense TELLE QU'ELLE ÉTAIT au moment du règlement — or `expense`,
-- `expense_share` et `aid` sont réécrits sur place (aide supprimée = hard
-- delete). Chaque modification commence donc par figer l'état courant ici,
-- append-only : une ligne = l'état de la dépense jusqu'à `replaced_at`.
--
-- Appelé explicitement par les repositories (`snapshot_expense`) AVANT toute
-- réécriture (scalaires/parts, ajout ou retrait d'aide) — pas de trigger : la
-- réécriture des parts se fait en plusieurs requêtes (précédent non atomique
-- de `updateExpenseWithShares`), aucun trigger ne verrait un état cohérent.
-- Un soft delete n'est pas historisé ici : `deleted_at` suffit.
create table expense_revision (
  id                 uuid primary key default gen_random_uuid(),
  expense_id         uuid not null references expense (id),
  replaced_at        timestamptz not null default now(),
  replaced_by        uuid references member (id),
  label              text not null,
  category           expense_category not null,
  gross_amount_cents integer not null,
  payer_member_id    uuid not null references member (id),
  incurred_on        date not null,
  shares             jsonb not null, -- [{"member_id", "share_cents", "share_pct_snapshot"}]
  aids               jsonb not null  -- [{"id", "beneficiary_member_id", "label", "amount_cents", "created_at"}]
);

create index expense_revision_expense_id_idx on expense_revision (expense_id, replaced_at);

alter table expense_revision enable row level security;

-- Lecture et insertion pour les membres du foyer de la dépense ; ni update ni
-- delete (historique append-only).
create policy expense_revision_member_read on expense_revision
  for select to authenticated
  using (private.can_access_expense(expense_id));

create policy expense_revision_member_insert on expense_revision
  for insert to authenticated
  with check (private.can_access_expense(expense_id));

grant select, insert on expense_revision to authenticated;

create function public.snapshot_expense(p_expense_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.expense_revision (
    expense_id, replaced_by, label, category, gross_amount_cents,
    payer_member_id, incurred_on, shares, aids
  )
  select
    e.id,
    private.current_member_id(),
    e.label,
    e.category,
    e.gross_amount_cents,
    e.payer_member_id,
    e.incurred_on,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'member_id', s.member_id,
        'share_cents', s.share_cents,
        'share_pct_snapshot', s.share_pct_snapshot))
      from public.expense_share s where s.expense_id = e.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'beneficiary_member_id', a.beneficiary_member_id,
        'label', a.label,
        'amount_cents', a.amount_cents,
        'created_at', a.created_at))
      from public.aid a where a.expense_id = e.id
    ), '[]'::jsonb)
  from public.expense e
  where e.id = p_expense_id;
$$;

grant execute on function public.snapshot_expense to authenticated;
