-- Stamped database. Paste this whole file into Supabase → SQL Editor → New query, then Run.
-- Safe to run once on a new project.

-- ============ Profiles ============
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (char_length(username) between 2 and 20),
  is_pass boolean not null default false,
  pass_until timestamptz,
  stripe_customer_id text unique,
  cover text not null default 'navy',
  ink text not null default 'classic',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Read own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Players may change their name and style, never their Pass status.
revoke update on public.profiles from authenticated, anon;
grant update (username, cover, ink) on public.profiles to authenticated;

-- Make a profile automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'username'), ''), split_part(new.email, '@', 1));
  name text := left(base, 20);
begin
  if char_length(name) < 2 then name := 'traveler'; end if;
  while exists (select 1 from public.profiles where username = name) loop
    name := left(base, 15) || floor(random() * 10000)::text;
  end loop;
  insert into public.profiles (id, username) values (new.id, name);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ Results ============
create table public.results (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('daily', 'archive', 'layover', 'borderrun', 'grid', 'sprint', 'standing')),
  day_key text not null check (day_key ~ '^\d{4}-\d{2}-\d{2}$'),
  run_id text not null default 'daily',
  score integer not null check (score between 0 and 5000),
  detail jsonb,
  played_at timestamptz not null default now(),
  unique (user_id, mode, day_key, run_id)
);
create index results_user_idx on public.results (user_id, played_at);
create index results_daily_idx on public.results (mode, day_key);

alter table public.results enable row level security;
create policy "Read own results" on public.results for select using (auth.uid() = user_id);
create policy "Insert own results" on public.results for insert with check (auth.uid() = user_id);
create policy "Update own results" on public.results for update using (auth.uid() = user_id);

-- ============ Leagues ============
create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  code text not null unique,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.league_members (
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;

create or replace function public.is_league_member(lid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.league_members where league_id = lid and user_id = auth.uid());
$$;

create policy "Members read their leagues" on public.leagues for select using (public.is_league_member(id));
create policy "Members read membership" on public.league_members for select using (public.is_league_member(league_id));
create policy "Leave a league" on public.league_members for delete using (auth.uid() = user_id);
-- Creating and joining go through the functions below, so there are no insert policies.

create or replace function public.has_pass(uid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select is_pass and (pass_until is null or pass_until > now()) from public.profiles where id = uid), false);
$$;

create or replace function public.create_league(league_name text)
returns text language plpgsql security definer set search_path = public as $$
declare
  new_code text;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if not public.has_pass(auth.uid()) then raise exception 'Starting a league needs an active pass.'; end if;
  if (select count(*) from public.leagues where owner_id = auth.uid()) >= 10 then raise exception 'You can own up to 10 leagues.'; end if;
  loop
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
      into new_code from generate_series(1, 6);
    exit when not exists (select 1 from public.leagues where code = new_code);
  end loop;
  insert into public.leagues (name, code, owner_id) values (trim(league_name), new_code, auth.uid()) returning id into new_id;
  insert into public.league_members (league_id, user_id) values (new_id, auth.uid());
  return new_code;
end $$;

create or replace function public.join_league(join_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  lid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select id into lid from public.leagues where code = upper(trim(join_code));
  if lid is null then raise exception 'League not found.'; end if;
  if (select count(*) from public.league_members where league_id = lid) >= 50 then raise exception 'That league is full.'; end if;
  insert into public.league_members (league_id, user_id) values (lid, auth.uid()) on conflict do nothing;
  return lid;
end $$;

create or replace function public.league_board(lid uuid, since_key text)
returns table (user_id uuid, username text, trips bigint, points bigint)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.is_league_member(lid) then raise exception 'You are not in that league.'; end if;
  return query
    select m.user_id, p.username, count(r.id), coalesce(sum(r.score), 0)
    from public.league_members m
    join public.profiles p on p.id = m.user_id
    left join public.results r on r.user_id = m.user_id and r.mode = 'daily' and r.day_key >= since_key
    where m.league_id = lid
    group by m.user_id, p.username
    order by coalesce(sum(r.score), 0) desc, p.username;
end $$;

grant execute on function public.create_league(text), public.join_league(text), public.league_board(uuid, text) to authenticated;
