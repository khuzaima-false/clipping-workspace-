-- Adds the optional channel ownership email to channels.
-- Apply after the initial schema (supabase/schema.sql).

alter table public.channels
  add column if not exists channel_email text;

comment on column public.channels.channel_email is
  'Optional mailbox used for the channel email ownership check.';
