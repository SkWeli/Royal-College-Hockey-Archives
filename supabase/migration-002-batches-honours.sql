-- Update 002: batch = school-leaving year, U9–1st XI only, structured hockey honours, team roles.
-- Run once in Supabase SQL Editor. Safe to run on the existing archive.

-- 1. Batch is now the year the player left school (e.g. 2021 = "Batch of 2021"), plus the year he joined.
alter table players add column if not exists joined_year int check (joined_year between 1835 and 2100);
alter table players alter column batch type int using (case when batch ~ '^\d{4}$' then batch::int end);
alter table players add constraint players_batch_year check (batch between 1835 and 2100);
comment on column players.batch is 'School-leaving year, e.g. 2021';

-- 2. Age groups: U9, U11, U13, U15, U17 and 1st XI.
alter table teams drop constraint if exists teams_age_group_check;
alter table teams add constraint teams_age_group_check check (age_group in ('U9','U11','U13','U15','U17','1st XI'));

-- 3. Team roles. Secretary is only for the 1st XI (checked in the website forms).
alter table team_memberships drop constraint if exists team_memberships_role_check;
alter table team_memberships add constraint team_memberships_role_check
  check (role is null or role in ('Captain','Vice-captain','Secretary'));

-- 4. Hockey honours use fixed names: 'Royal Colours', 'Colombo Schools Colours', 'National Colours',
--    'Royal Crown', or free text for anything else. level holds e.g. '1st Year' for Royal Colours.
update achievements set title = 'Royal Colours' where title = 'Colours';
