-- Royal College Hockey Archive — database schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

-- ============ Core tables (public to read) ============

create table players (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  known_as text,                       -- e.g. "Roshan ayya"
  batch text,                          -- e.g. "88/89" or "O/L 1985"
  photo_url text,
  bio text,
  other_sports text[] default '{}',    -- e.g. {'Boxing'}
  created_at timestamptz default now()
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  age_group text not null check (age_group in ('U9','U11','U13','U15','U17','U19','1st XI','2nd XI')),
  season int not null,                 -- year, e.g. 2016
  coach text,
  notes text,
  unique (age_group, season)
);

create table team_memberships (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  role text,                           -- 'Captain', 'Vice-captain', null
  position text,
  unique (player_id, team_id)
);

create table achievements (               -- awards for individual players
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  title text not null,                 -- e.g. 'Hockey colours'
  sport text default 'Hockey',
  level text,                          -- e.g. '1st year', '2nd year', 'National', 'Best player'
  season int,
  source text
);

create table team_achievements (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  title text not null,                 -- e.g. 'All-Island Championship'
  finish text,                        -- e.g. 'Champions', '3rd place'
  source text
);

create table venues (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  city text,
  surface text                          -- 'Grass', 'Astro'
);

create table opponents (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level text,                          -- 'League', 'All-Island', 'Big match', 'Friendly'
  season int
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  opponent_id uuid references opponents(id),
  venue_id uuid references venues(id),
  tournament_id uuid references tournaments(id),
  match_date date,
  score_for int,
  score_against int,
  stage text,                          -- 'Final', 'Semi-final', 'Group'
  notes text,
  source text                          -- e.g. 'Daily News, 12 Mar 1989'
);

create table match_players (
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  role text,
  primary key (match_id, player_id)
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid references players(id) on delete set null,
  minute int,
  kind text                            -- 'Field goal', 'Penalty corner', 'Penalty stroke'
);

create table milestones (                 -- club history for the timeline
  id uuid primary key default gen_random_uuid(),
  event_date date,
  season int not null,
  title text not null,
  details text,
  source text
);

-- ============ Private table (members only) ============

create table contacts (
  player_id uuid primary key references players(id) on delete cascade,
  phone text,
  email text,
  city text,
  consent boolean not null default false,   -- only store with the person's permission
  updated_at timestamptz default now()
);

-- People allowed to see contacts / edit data. Add rows here by hand.
create table members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  is_editor boolean not null default false
);

-- ============ Row-level security ============

create or replace function is_member() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from members where user_id = auth.uid()) $$;

create or replace function is_editor() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from members where user_id = auth.uid() and is_editor) $$;

do $$
declare t text;
begin
  foreach t in array array['players','teams','team_memberships','achievements','team_achievements',
                           'venues','opponents','tournaments','matches','match_players','goals','milestones']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "public read" on %I for select using (true)', t);
    execute format('create policy "editors write" on %I for all using (is_editor()) with check (is_editor())', t);
  end loop;
end $$;

alter table contacts enable row level security;
create policy "members read contacts" on contacts for select using (is_member() and consent);
create policy "editors write contacts" on contacts for all using (is_editor()) with check (is_editor());

alter table members enable row level security;
create policy "see own membership" on members for select using (user_id = auth.uid());
