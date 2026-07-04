-- Étale — schéma initial (spec-technique ch.3.2). Couche donnée feuille.
-- Argent : integer CENTIMES partout ; numeric(5,2) réservé aux pourcentages.
-- Timestamps timestamptz (UTC, D4). Soft delete via deleted_at (D2).
-- Aucun trigger d'invariant multi-lignes (D-INV1 : test + logique métier).

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums (D18 pour les catégories)
-- ─────────────────────────────────────────────────────────────────────────────
create type expense_category as enum ('loyer', 'courses', 'charges', 'sorties', 'autre');
create type settlement_status as enum ('pending', 'confirmed', 'cancelled');

-- ─────────────────────────────────────────────────────────────────────────────
-- member — 1-1 avec auth.users (D3)
-- ─────────────────────────────────────────────────────────────────────────────
create table member (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id),
  display_name text not null,
  created_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- household
-- ─────────────────────────────────────────────────────────────────────────────
create table household (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- membership — porte le ratio par défaut du membre dans le foyer + role (DA13)
-- ─────────────────────────────────────────────────────────────────────────────
create table membership (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references household (id),
  member_id         uuid not null references member (id),
  default_share_pct numeric(5, 2) not null check (default_share_pct >= 0 and default_share_pct <= 100),
  role              text not null default 'member',
  joined_at         timestamptz not null default now(),
  unique (household_id, member_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- settlement — régularisation à double approbation (D15, D16)
-- Créée avant expense car expense.settlement_id la référence.
-- ─────────────────────────────────────────────────────────────────────────────
create table settlement (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references household (id),
  status         settlement_status not null default 'pending',
  amount_cents   integer not null check (amount_cents > 0),
  from_member_id uuid not null references member (id),
  to_member_id   uuid not null references member (id),
  initiated_by   uuid not null references member (id),
  initiated_at   timestamptz not null default now(),
  confirmed_by   uuid references member (id),
  confirmed_at   timestamptz,
  cancelled_at   timestamptz
);

-- ─────────────────────────────────────────────────────────────────────────────
-- expense — charge du foyer, ponctuelle ou générée par une récurrence
-- ─────────────────────────────────────────────────────────────────────────────
create table expense (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references household (id),
  label              text not null,
  category           expense_category not null default 'autre',
  gross_amount_cents integer not null check (gross_amount_cents > 0),
  payer_member_id    uuid not null references member (id),
  incurred_on        date not null,
  source             text not null default 'manual' check (source in ('manual', 'recurring')),
  settlement_id      uuid references settlement (id),
  created_by         uuid references member (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

-- ─────────────────────────────────────────────────────────────────────────────
-- expense_share — parts FIGÉES (snapshot), une par membre concerné (D1)
-- ─────────────────────────────────────────────────────────────────────────────
create table expense_share (
  id                 uuid primary key default gen_random_uuid(),
  expense_id         uuid not null references expense (id),
  member_id          uuid not null references member (id),
  share_cents        integer not null check (share_cents >= 0),
  share_pct_snapshot numeric(5, 2) not null,
  unique (expense_id, member_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- aid — aide rattachée à une dépense, perçue par un membre (D9, D10)
-- ─────────────────────────────────────────────────────────────────────────────
create table aid (
  id                    uuid primary key default gen_random_uuid(),
  expense_id            uuid not null references expense (id),
  beneficiary_member_id uuid not null references member (id),
  label                 text not null,
  amount_cents          integer not null check (amount_cents > 0),
  created_at            timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- recurring_template — modèle d'une charge récurrente (D12, D13)
-- ─────────────────────────────────────────────────────────────────────────────
create table recurring_template (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household (id),
  label           text not null,
  category        expense_category not null,
  amount_cents    integer not null check (amount_cents > 0),
  payer_member_id uuid not null references member (id),
  day_of_month    smallint not null check (day_of_month between 1 and 31),
  shares_config   jsonb not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- recurring_aid — aide récurrente adossée à un template
-- ─────────────────────────────────────────────────────────────────────────────
create table recurring_aid (
  id                    uuid primary key default gen_random_uuid(),
  template_id           uuid not null references recurring_template (id),
  beneficiary_member_id uuid not null references member (id),
  label                 text not null,
  amount_cents          integer not null check (amount_cents > 0)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- recurring_occurrence — trace de génération, idempotence (critique C7)
-- ─────────────────────────────────────────────────────────────────────────────
create table recurring_occurrence (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references recurring_template (id),
  period       date not null,
  expense_id   uuid not null references expense (id),
  generated_at timestamptz not null default now(),
  unique (template_id, period)
);
