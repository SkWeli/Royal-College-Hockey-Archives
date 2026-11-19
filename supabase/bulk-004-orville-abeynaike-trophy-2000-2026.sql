-- Orville Abeynaike Memorial Trophy (1st XI vs S. Thomas' College), 2000–2026.
-- Source: "Orville Abeynaike Memorial Trophy Series Results" page (2000–2018), and the admin (2019–2026).
-- Scores are Royal first. Matches already in the archive for a year are updated, not duplicated.
-- The result (Winners / Drawn / Lost) is worked out from each score automatically.
-- Safe to run more than once.
begin;

-- 1. Venues (all the "Astro Turf" games in the series were at the Colombo astro turf)
insert into venues (name, city, surface) values
  ('Astro Turf, Colombo', 'Colombo', 'Astro'),
  ('Astro Turf, Matale', 'Matale', 'Astro'),
  ('RC Grounds', 'Colombo', 'Grass'),
  ('STC Grounds', 'Mount Lavinia', 'Grass'),
  ('Colombo University Grounds', 'Colombo', 'Grass')
on conflict (name) do nothing;

-- 2. The opponent
insert into opponents (name) values ('S. Thomas'' College, Mount Lavinia') on conflict (name) do nothing;

-- 3. The results
create temp table orville (season int, royal int, stc int, venue text) on commit drop;
insert into orville values
(2000,0,4,'Astro Turf, Colombo'), (2001,0,2,'Astro Turf, Colombo'), (2002,0,3,'Astro Turf, Colombo'),
(2003,0,1,'Astro Turf, Colombo'), (2004,2,3,'Astro Turf, Colombo'), (2005,2,3,'Astro Turf, Colombo'),
(2006,1,2,'Astro Turf, Colombo'), (2007,4,0,'Astro Turf, Colombo'), (2008,6,6,'STC Grounds'),
(2009,1,1,'RC Grounds'),          (2010,4,1,'STC Grounds'),         (2011,4,0,'RC Grounds'),
(2012,4,1,'STC Grounds'),         (2013,0,0,'Astro Turf, Colombo'), (2014,3,0,'STC Grounds'),
(2015,2,1,'Astro Turf, Colombo'), (2016,0,0,'Astro Turf, Colombo'), (2017,1,3,'Astro Turf, Colombo'),
(2018,0,1,'Astro Turf, Colombo'),
-- 2019 is already in the archive (0–0); 2020 and 2021 were not played (see step 7)
(2022,0,1,'Astro Turf, Colombo'), (2023,1,0,'Colombo University Grounds'), (2024,1,0,'STC Grounds'),
(2025,2,1,'Astro Turf, Colombo'), (2026,2,1,'Astro Turf, Colombo');

-- 4. A 1st XI team for every year
insert into teams (age_group, season) select '1st XI', season from orville on conflict (age_group, season) do nothing;

-- 5. The trophy as a competition for each year (marked as a trophy match)
insert into tournaments (name, level, season)
select 'Orville Abeynaike Memorial Trophy', 'Trophy match', o.season from orville o
where not exists (select 1 from tournaments t where t.name ilike 'Orville Abeynaike Memorial Trophy' and t.season = o.season);
update tournaments set level = 'Trophy match' where name ilike 'Orville Abeynaike Memorial Trophy' and level is distinct from 'Trophy match';

-- 6. Update matches that are already there, then add the rest
create temp table resolved on commit drop as
select o.*, t.id as team_id, op.id as opponent_id, v.id as venue_id,
  (select id from tournaments x where x.name ilike 'Orville Abeynaike Memorial Trophy' and x.season = o.season order by id limit 1) as tournament_id
from orville o
join teams t on t.age_group = '1st XI' and t.season = o.season
join opponents op on op.name = 'S. Thomas'' College, Mount Lavinia'
join venues v on v.name = o.venue;

-- an existing match that year against S. Thomas' in this trophy (or against S. Thomas' with no competition set)
update matches m set score_for = r.royal, score_against = r.stc, venue_id = r.venue_id, tournament_id = r.tournament_id,
  source = coalesce(m.source, 'Orville Abeynaike Memorial Trophy series results')
from resolved r
where m.team_id = r.team_id and m.opponent_id = r.opponent_id
  and (m.tournament_id is null or m.tournament_id in (select id from tournaments where name ilike 'Orville Abeynaike Memorial Trophy'));

insert into matches (team_id, opponent_id, venue_id, tournament_id, score_for, score_against, source)
select r.team_id, r.opponent_id, r.venue_id, r.tournament_id, r.royal, r.stc, 'Orville Abeynaike Memorial Trophy series results'
from resolved r
where not exists (
  select 1 from matches m where m.team_id = r.team_id and m.opponent_id = r.opponent_id
    and (m.tournament_id is null or m.tournament_id in (select id from tournaments where name ilike 'Orville Abeynaike Memorial Trophy'))
);

-- 7. 2020 and 2021: not played
insert into milestones (season, title, details)
select y, 'Orville Abeynaike Memorial Trophy not played', 'Not played due to the COVID-19 pandemic.'
from (values (2020), (2021)) v(y)
where not exists (select 1 from milestones where season = y and title = 'Orville Abeynaike Memorial Trophy not played');

-- Check: one line per year
select t.season, m.score_for || '–' || m.score_against as score,
  case when m.score_for > m.score_against then 'Winners' when m.score_for = m.score_against then 'Drawn' else 'Lost' end as result,
  v.name as venue
from matches m join teams t on t.id = m.team_id join tournaments tr on tr.id = m.tournament_id left join venues v on v.id = m.venue_id
where tr.name ilike 'Orville Abeynaike Memorial Trophy' order by t.season;

commit;
