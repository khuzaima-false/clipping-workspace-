-- ============================================================
-- Forgevyn Clipping Workspace — initial schema
-- Apply with:  supabase db push   (or paste into the SQL Editor)
-- ============================================================

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  email                text not null,
  display_name         text,
  is_founding_user     boolean not null default false,
  theme_preference     text not null default 'default-dark',
  referral_code        text unique,
  -- The id of the user who referred this account (see /ref/[userId]).
  referred_by          text,
  -- Denormalised count of successful referrals.
  referral_count       integer not null default 0,
  -- Export credits, refilled once per UTC day (100 base + 10 per referral).
  daily_credits        integer not null default 100,
  last_credit_reset    timestamptz not null default now(),
  -- Ad-free entitlement (no longer granted by referrals).
  is_ad_free           boolean not null default false,
  ad_free_until        timestamptz,
  active_seconds       integer not null default 0,
  created_at           timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user; created automatically by the handle_new_user trigger.';
comment on column public.profiles.daily_credits is
  'Export credits for the current UTC day (100 base + 500 founding + 10 per referral, max 12).';
comment on column public.profiles.is_founding_user is
  'True for the first 1,000 accounts; grants +500 daily credits.';

-- ------------------------------------------------------------
-- referrals
-- ------------------------------------------------------------
-- One row per successfully attributed referral. Row Level Security lets a user
-- read rows where they are the referrer or the referred account.
create table if not exists public.referrals (
  id                uuid primary key default gen_random_uuid(),
  referrer_id       uuid not null references auth.users (id) on delete cascade,
  referred_user_id  uuid not null unique references auth.users (id) on delete cascade,
  created_at        timestamptz not null default now()
);

comment on table public.referrals is
  'Successful referral attributions created by handle_new_user.';

-- ------------------------------------------------------------
-- channels
-- ------------------------------------------------------------
create table if not exists public.channels (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  platform    text not null
                check (platform in ('YouTube', 'TikTok', 'Instagram')),
  niche       text,
  url         text,
  notes       text,
  -- Optional mailbox used for the channel email ownership check.
  channel_email text,
  created_at  timestamptz not null default now()
);

comment on column public.channels.platform is
  'Allowed values: ''YouTube'', ''TikTok'', ''Instagram'' (extend the check constraint to add more).';

-- ------------------------------------------------------------
-- projects
-- ------------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  channel_id  uuid references public.channels (id) on delete cascade,
  title       text not null,
  status      text not null default 'draft',
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
create index if not exists profiles_referral_code_idx
  on public.profiles (referral_code);

create index if not exists profiles_referred_by_idx
  on public.profiles (referred_by);

create index if not exists referrals_referrer_id_idx
  on public.referrals (referrer_id);

create index if not exists channels_user_id_idx
  on public.channels (user_id);

create index if not exists projects_user_id_idx
  on public.projects (user_id);

create index if not exists projects_channel_id_idx
  on public.projects (channel_id);

-- ------------------------------------------------------------
-- updated_at maintenance
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.profiles  enable row level security;
alter table public.channels  enable row level security;
alter table public.projects  enable row level security;
alter table public.referrals enable row level security;

-- profiles: a user only ever touches their own row (id = auth.uid())
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
  on public.profiles for delete
  to authenticated
  using (auth.uid() = id);

-- channels: scoped to the owning user
drop policy if exists "channels_select_own" on public.channels;
create policy "channels_select_own"
  on public.channels for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "channels_insert_own" on public.channels;
create policy "channels_insert_own"
  on public.channels for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "channels_update_own" on public.channels;
create policy "channels_update_own"
  on public.channels for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "channels_delete_own" on public.channels;
create policy "channels_delete_own"
  on public.channels for delete
  to authenticated
  using (auth.uid() = user_id);

-- projects: scoped to the owning user
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own"
  on public.projects for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own"
  on public.projects for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own"
  on public.projects for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own"
  on public.projects for delete
  to authenticated
  using (auth.uid() = user_id);

-- referrals: a user may read subscriptions where they are either party, and
-- may insert a row for themselves as the referred account (client fallback).
drop policy if exists "referrals_select_party" on public.referrals;
create policy "referrals_select_party"
  on public.referrals for select
  to authenticated
  using (auth.uid() = referrer_id or auth.uid() = referred_user_id);

drop policy if exists "referrals_insert_referred" on public.referrals;
create policy "referrals_insert_referred"
  on public.referrals for insert
  to authenticated
  with check (auth.uid() = referred_user_id);

-- ------------------------------------------------------------
-- Automatic profile creation on sign-up
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_founding boolean;
  v_daily_credits integer;
  v_ref text;
  v_referrer uuid;
begin
  -- The first 1,000 accounts are founding users: 600/day vs 100/day.
  select count(*) < 1000 into v_is_founding from public.profiles;
  v_daily_credits := case when v_is_founding then 600 else 100 end;

  v_ref := nullif(new.raw_user_meta_data ->> 'ref', '');
  if v_ref is not null then
    begin
      v_referrer := v_ref::uuid;
    exception when others then
      v_referrer := null;
    end;
  end if;

  insert into public.profiles (
    id,
    email,
    display_name,
    referral_code,
    is_founding_user,
    daily_credits,
    last_credit_reset,
    referred_by
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name',
             new.raw_user_meta_data ->> 'name'),
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    coalesce(v_is_founding, false),
    v_daily_credits,
    now(),
    case when v_referrer is not null then v_referrer::text else null end
  )
  on conflict (id) do nothing;

  -- Attribute the referral and reward the referrer.
  if v_referrer is not null
     and v_referrer <> new.id
     and exists (select 1 from public.profiles where id = v_referrer) then
    insert into public.referrals (referrer_id, referred_user_id)
    values (v_referrer, new.id)
    on conflict (referred_user_id) do nothing;

    update public.profiles
      set referral_count = referral_count + 1
      where id = v_referrer;

    -- Referral bonuses are derived from `referral_count` at reset time, so no
    -- extra write is needed here beyond incrementing the counter above.
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Daily credit deduction (server-authoritative)
-- ------------------------------------------------------------
-- SECURITY DEFINER so it can bypass RLS and the column-level UPDATE
-- privileges revoked below. Runs inside the caller's transaction; the row
-- lock (`for update`) makes the UTC refill + deduction atomic.
--
-- `cost` is the number of credits to spend (export = 2, captions = 3).
-- Refills to the account's allowance when `last_credit_reset` is before the
-- current UTC date (100 base + 500 founding + 10 per referral, capped at 12
-- referrals), then spends `cost` credits. Raises `INSUFFICIENT_CREDITS` when
-- the balance is below `cost`.
create or replace function public.deduct_user_credit(
  user_id uuid default null,
  cost integer default 1
)
returns table (
  remaining integer,
  is_founding boolean,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_founding boolean;
  v_referrals integer;
  v_reset timestamptz;
  v_credits integer;
  v_limit integer;
  v_cost integer;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  v_cost := greatest(coalesce(cost, 1), 1);

  -- A caller may only ever spend their own credits.
  v_target := coalesce(user_id, v_uid);
  if v_target <> v_uid then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select p.is_founding_user, p.last_credit_reset, p.daily_credits,
         p.referral_count
    into v_founding, v_reset, v_credits, v_referrals
    from public.profiles p
    where p.id = v_target
    for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Automatic UTC daily reset before deducting. Resets to the account's
  -- allowance (never stacks on top of a previous day's unused credits).
  if v_reset is null
     or (v_reset at time zone 'utc')::date < (now() at time zone 'utc')::date then
    v_limit := 100
      + (case when v_founding then 500 else 0 end)
      + 10 * least(greatest(coalesce(v_referrals, 0), 0), 12);
    v_credits := v_limit;
    v_reset := now();
  end if;

  if v_credits < v_cost then
    raise exception 'INSUFFICIENT_CREDITS' using errcode = 'P0001';
  end if;

  v_credits := v_credits - v_cost;
  update public.profiles
    set daily_credits = v_credits, last_credit_reset = v_reset
    where id = v_target;

  return query select v_credits, coalesce(v_founding, false), v_reset;
end;
$$;

grant execute on function public.deduct_user_credit(uuid, integer) to authenticated;

-- ------------------------------------------------------------
-- Column-level hardening
-- ------------------------------------------------------------
-- Clients may read their own profile (RLS above) but must not be able to
-- write their own balance or entitlement columns. Table-level INSERT/UPDATE/
-- DELETE are revoked and only safe columns are re-granted; profiles are only
-- created by the handle_new_user trigger and credits only mutate through
-- public.deduct_user_credit().
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, theme_preference, active_seconds)
  on public.profiles to authenticated;
