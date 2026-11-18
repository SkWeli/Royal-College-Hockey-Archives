-- First real entries, from the old boys' WhatsApp discussion on 17 Nov 2026.
-- Run after schema.sql. Fill in surnames, batches and seasons as they're confirmed.

with p as (
  insert into players (full_name, known_as, batch, other_sports, bio) values
    ('Roshan', 'Roshan ayya', null, '{Boxing}', 'Led the college in both boxing and hockey. Remembered for strict discipline and for mentoring juniors.'),
    ('Thisila Herath', null, null, '{Boxing}', null),
    ('Rohana Jayawickrama', null, '88/89', '{Boxing}', null)
  returning id, full_name
)
insert into achievements (player_id, title, sport, level, season, source)
select p.id, 'Colours', s.sport,
       case when p.full_name = 'Roshan' then 'Captain' end,
       case when p.full_name = 'Rohana Jayawickrama' then 1989 end,
       case when p.full_name = 'Rohana Jayawickrama' then 'Shihar Sir, WhatsApp, 17 Nov 2026'
            else 'WhatsApp group, 17 Nov 2026' end
from p cross join (values ('Hockey'), ('Boxing')) as s(sport);

