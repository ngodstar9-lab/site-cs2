-- Optional personal study-data sync for Noor Quran.
-- Run this file once in Supabase SQL Editor. It does not modify existing Quran/admin tables.
create table if not exists public.quran_user_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  backup jsonb not null,
  updated_at timestamptz not null default now(),
  constraint quran_user_backups_backup_object check (jsonb_typeof(backup) = 'object'),
  constraint quran_user_backups_backup_size check (pg_column_size(backup) <= 1048576)
);
alter table public.quran_user_backups enable row level security;
revoke all on table public.quran_user_backups from anon;
grant select, insert, update, delete on table public.quran_user_backups to authenticated;
drop policy if exists "Users can read their own Quran backup" on public.quran_user_backups;
create policy "Users can read their own Quran backup" on public.quran_user_backups for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can create their own Quran backup" on public.quran_user_backups;
create policy "Users can create their own Quran backup" on public.quran_user_backups for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their own Quran backup" on public.quran_user_backups;
create policy "Users can update their own Quran backup" on public.quran_user_backups for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their own Quran backup" on public.quran_user_backups;
create policy "Users can delete their own Quran backup" on public.quran_user_backups for delete to authenticated using ((select auth.uid()) = user_id);
comment on table public.quran_user_backups is 'Optional user-owned backup of Noor Quran local study preferences; protected by per-user RLS.';
