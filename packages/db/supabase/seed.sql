-- Étale — seed de dogfooding (spec-technique ch.3.4, D17 bootstrap manuel, DA13).
-- LOCAL UNIQUEMENT : appliqué par `supabase db reset` après les migrations.
-- Crée les comptes auth (member 1-1 auth.users, D3), le foyer, les adhésions
-- 50/50 avec role='admin' sur ma membership, et le template loyer + APL.
--
-- UUIDs fixes pour lisibilité. Mots de passe locaux (dogfooding), non secrets.

-- ── Comptes d'authentification (2 membres du foyer) ─────────────────────────
-- Les colonnes de tokens (confirmation_token, recovery_token, *_change*, …) sont
-- posées à '' et NON NULL : GoTrue les scanne en `string` Go et un NULL fait
-- échouer le login (« Database error querying schema »). Détail classique du seed
-- manuel d'auth.users.
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
   confirmation_token, recovery_token, email_change_token_new, email_change,
   email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'nathan@etale.local',
   extensions.crypt('password-nathan', extensions.gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}',
   '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'copine@etale.local',
   extensions.crypt('password-copine', extensions.gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}',
   '', '', '', '', '', '', '', '');

-- Identités email (permet la connexion GoTrue en local).
insert into auth.identities
  (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-111111111111',
   '{"sub":"11111111-1111-1111-1111-111111111111","email":"nathan@etale.local"}',
   'email', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222',
   '22222222-2222-2222-2222-222222222222',
   '{"sub":"22222222-2222-2222-2222-222222222222","email":"copine@etale.local"}',
   'email', now(), now(), now());

-- ── Membres ─────────────────────────────────────────────────────────────────
insert into member (id, auth_user_id, display_name) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Nathan'),
  ('a0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Léa');

-- ── Foyer ─────────────────────────────────────────────────────────────────--
insert into household (id, name) values
  ('d0000000-0000-0000-0000-000000000001', 'Maison');

-- ── Adhésions 50/50 — role='admin' sur ma membership (DA13) ─────────────────
insert into membership (household_id, member_id, default_share_pct, role) values
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 50.00, 'admin'),
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 50.00, 'member');

-- ── Template loyer récurrent + APL adossée ──────────────────────────────────
insert into recurring_template
  (id, household_id, label, category, amount_cents, payer_member_id, day_of_month, shares_config)
values
  ('c0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000001',
   'Loyer', 'loyer', 80000,
   'a0000000-0000-0000-0000-000000000001', 5,
   '[{"member_id":"a0000000-0000-0000-0000-000000000001","pct":50},
     {"member_id":"a0000000-0000-0000-0000-000000000002","pct":50}]'::jsonb);

insert into recurring_aid (template_id, beneficiary_member_id, label, amount_cents) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'APL', 20000);
