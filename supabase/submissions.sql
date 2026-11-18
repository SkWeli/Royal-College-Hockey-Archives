-- Public submissions waiting for admin review.
-- Run once in Supabase SQL Editor (after schema.sql).

create table submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                    -- 'Player', 'Team', 'Match', 'Honour', 'Correction', 'Other'
  details jsonb not null default '{}',   -- the form fields
  submitter_name text not null check (length(submitter_name) between 2 and 120),
  submitter_contact text check (length(submitter_contact) <= 200),
  submitter_batch text check (length(submitter_batch) <= 40),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  created_at timestamptz default now(),
  check (length(details::text) < 10000)
);

alter table submissions enable row level security;

-- Anyone can send a submission, but only as 'pending'.
create policy "anyone submits" on submissions for insert
  with check (status = 'pending' and admin_note is null);

-- Only editors can read and review them.
create policy "editors review" on submissions for all using (is_editor()) with check (is_editor());
