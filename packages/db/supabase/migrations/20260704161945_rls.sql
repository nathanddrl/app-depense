-- Étale — Row Level Security par foyer (spec-technique ch.3.3). PRIORITÉ 1 (DA11).
-- Isolation : une ligne n'est lisible/éditable que par un membre du household_id
-- concerné, via la jointure membership → member.auth_user_id = auth.uid().
--
-- Anti-récursion : les policies s'appuient sur des fonctions SECURITY DEFINER
-- (schéma `private`) qui contournent la RLS pour résoudre l'appartenance — sinon
-- une policy sur `membership` qui interroge `membership` boucle à l'infini.

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers d'autorisation (SECURITY DEFINER → bypass RLS, search_path figé)
-- ─────────────────────────────────────────────────────────────────────────────
create schema if not exists private;

-- member.id du auth.uid() courant (member 1-1 auth.users, D3).
create function private.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.member where auth_user_id = auth.uid();
$$;

-- Le membre courant adhère-t-il au foyer `hid` ?
create function private.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.membership m
    join public.member mem on mem.id = m.member_id
    where m.household_id = hid
      and mem.auth_user_id = auth.uid()
  );
$$;

-- Le membre `target` partage-t-il un foyer avec le membre courant ? (visibilité member)
create function private.shares_household(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.membership self_m
    join public.membership other_m on other_m.household_id = self_m.household_id
    join public.member self_mem on self_mem.id = self_m.member_id
    where self_mem.auth_user_id = auth.uid()
      and other_m.member_id = target
  );
$$;

-- Accès à la dépense parente `eid` (pour les tables enfants sans household_id).
create function private.can_access_expense(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_household_member(household_id)
  from public.expense
  where id = eid;
$$;

-- Accès au template parent `tid` (pour recurring_aid / recurring_occurrence).
create function private.can_access_template(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_household_member(household_id)
  from public.recurring_template
  where id = tid;
$$;

grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

-- Le rôle `authenticated` a besoin des privilèges de table ; la RLS filtre les lignes.
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Activation RLS sur les 10 tables métier
-- ─────────────────────────────────────────────────────────────────────────────
alter table member enable row level security;
alter table household enable row level security;
alter table membership enable row level security;
alter table settlement enable row level security;
alter table expense enable row level security;
alter table expense_share enable row level security;
alter table aid enable row level security;
alter table recurring_template enable row level security;
alter table recurring_aid enable row level security;
alter table recurring_occurrence enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- Policies parents (scoping direct par household_id)
-- ─────────────────────────────────────────────────────────────────────────────

-- member : sa propre ligne + les membres partageant un de ses foyers (divergence
-- assumée vs ch.3.3 qui omet member — évite de fuiter tous les users).
create policy member_household_access on member
  for all to authenticated
  using (auth_user_id = auth.uid() or private.shares_household(id))
  with check (auth_user_id = auth.uid());

create policy household_member_access on household
  for all to authenticated
  using (private.is_household_member(id))
  with check (private.is_household_member(id));

create policy membership_member_access on membership
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

create policy settlement_member_access on settlement
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

create policy expense_member_access on expense
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

create policy recurring_template_member_access on recurring_template
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Policies enfants (héritées via le parent)
-- ─────────────────────────────────────────────────────────────────────────────
create policy expense_share_member_access on expense_share
  for all to authenticated
  using (private.can_access_expense(expense_id))
  with check (private.can_access_expense(expense_id));

create policy aid_member_access on aid
  for all to authenticated
  using (private.can_access_expense(expense_id))
  with check (private.can_access_expense(expense_id));

create policy recurring_aid_member_access on recurring_aid
  for all to authenticated
  using (private.can_access_template(template_id))
  with check (private.can_access_template(template_id));

create policy recurring_occurrence_member_access on recurring_occurrence
  for all to authenticated
  using (private.can_access_template(template_id))
  with check (private.can_access_template(template_id));
