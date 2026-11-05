-- CS2 ZONE phone-verified community membership; run once in Supabase SQL Editor.
create table if not exists public.community_members (
 id uuid primary key references auth.users(id) on delete cascade,
 phone text not null unique,
 display_name text not null check (char_length(display_name) between 1 and 60),
 created_at timestamptz not null default now()
);
alter table public.community_members enable row level security;
drop policy if exists "Public can view community display names" on public.community_members;
drop policy if exists "Members can register themselves" on public.community_members;
drop policy if exists "Members can update their own profile" on public.community_members;
create policy "Public can view community display names" on public.community_members for select to anon, authenticated using (true);
create policy "Members can register themselves" on public.community_members for insert to authenticated with check (auth.uid() = id);
create policy "Members can update their own profile" on public.community_members for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
grant select (id, display_name, created_at) on public.community_members to anon, authenticated;
grant insert (id, phone, display_name) on public.community_members to authenticated;
grant update (id, phone, display_name) on public.community_members to authenticated;