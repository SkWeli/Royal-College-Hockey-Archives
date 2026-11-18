-- First real entries, from the old boys' WhatsApp discussion on 17 Nov 2026.
-- Run after schema.sql (new installs only). Fill in batches and years as they're confirmed.

with p as (
  insert into players (full_name, known_as, other_sports, bio) values
    ('Roshan', 'Roshan ayya', '{Boxing}', 'Led the college in both boxing and hockey. Remembered for strict discipline and for mentoring juniors.'),
    ('Thisila Herath', null, '{Boxing}', null),
    ('Rohana Jayawickrama', null, '{Boxing}', null)
  returning id, full_name
)
insert into achievements (player_id, title, sport, source)
select p.id, 'Royal Colours', s.sport,
       case when p.full_name = 'Rohana Jayawickrama' then 'Shihar Sir, WhatsApp, 17 Nov 2026 (given as 88/89)'
            else 'WhatsApp group, 17 Nov 2026' end
from p cross join (values ('Hockey'), ('Boxing')) as s(sport);
