-- ============================================================
-- Task 5: daily export credits, referrals, and ad placements
-- Apply after 0001_add_channel_email.sql.
-- Safe to run more than once.
-- ============================================================

-- ------------------------------------------------------------
-- profiles: founding flag + credits + referral/ad columns
-- ------------------------------------------------------------
-- Older installs used `is_founding_clipper`; migrate it to `is_founding_user`.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'is_founding_clipper'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'is_founding_user'
  ) then
    alter table public.profiles
      rename column is_founding_clipper to is_founding_user;
  end if;
end $$;

alter table public.profiles
  add column if not exists is_founding_user boolean not null default false,
  add column if not exists referral_count   integer not null default 0,
  add column if not exists daily_credits    integer not null default 20,
  add column if not exists last_credit_reset timestamptz not null default now(),
  add column if not exists is_ad_free       boolean not null default false,
  add column if not exists ad_free_until    timestamptz;

-- Task 6 economy: 20/day standard, 25/day founding.
alter table public.profiles
  alter column daily_credits set default 20;

comment on column public.profiles.daily_credits is
  'Export credits for the current UTC day (20 standard, 25 founding).';
comment on column public.profiles.is_founding_user is
  'True for the first 1,000 accounts; grants 25 credits/day.';

create index if not exists profiles_referred_by_idx
  on public.profiles (referred_by);

-- ------------------------------------------------------------
-- referrals
-- ------------------------------------------------------------
create table if not exists public.referrals (
  id                uuid primary key default gen_random_uuid(),
  referrer_id       uuid not null references auth.users (id) on delete cascade,
  referred_user_id  uuid not null unique references auth.users (id) on delete cascade,
  created_at        timestamptz not null default now()
);

create index if not exists referrals_referrer_id_idx
  on public.referrals (referrer_id);

alter table public.referrals enable row level security;

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
-- handle_new_user: founding status, daily credits, referral reward
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
  select count(*) < 1000 into v_is_founding from public.profiles;
  v_daily_credits := case when v_is_founding then 25 else 20 end;

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

  if v_referrer is not null
     and v_referrer <> new.id
     and exists (select 1 from public.profiles where id = v_referrer) then
    insert into public.referrals (referrer_id, referred_user_id)
    values (v_referrer, new.id)
    on conflict (referred_user_id) do nothing;

    update public.profiles
      set referral_count = referral_count + 1
      where id = v_referrer;

    update public.profiles
      set is_ad_free = true,
          ad_free_until = greatest(coalesce(ad_free_until, now()), now())
                          + interval '90 days'
      where id = v_referrer
        and referral_count >= 10;
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- deduct_user_credit: server-authoritative atomic spend
-- ------------------------------------------------------------
-- Remove the earlier, less strict helpers if they exist.
drop function if exists public.consume_export_credit();
drop function if exists public.deduct_user_credit(uuid);

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

  select p.is_founding_user, p.last_credit_reset, p.daily_credits
    into v_founding, v_reset, v_credits
    from public.profiles p
    where p.id = v_target
    for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Automatic UTC daily reset before deducting.
  if v_reset is null
     or (v_reset at time zone 'utc')::date < (now() at time zone 'utc')::date then
    v_limit := case when v_founding then 25 else 20 end;
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
-- Clients may SELECT their own profile but must not write balance /
-- entitlement columns directly, nor delete/re-insert their row to forge a
-- balance. Table-level INSERT/UPDATE/DELETE are revoked; only safe columns
-- are re-granted. All credit mutations go through deduct_user_credit.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, theme_preference, active_seconds)
  on public.profiles to authenticated;
