// Demo data used when no Supabase project is connected yet.
// Names marked "(sample)" are made up, only to show how the site works.
// The three real entries come from the old boys' WhatsApp discussion (17 Nov 2026).

const P = (id, full_name, extra = {}) => ({ id, full_name, other_sports: [], ...extra })
const T = (id, age_group, season, extra = {}) => ({ id, age_group, season, ...extra })

export const sample = {
  players: [
    P('p-roshan', 'Roshan', { known_as: 'Roshan ayya', other_sports: ['Boxing'], bio: 'Led the college in both boxing and hockey. Remembered for strict discipline and for mentoring juniors.' }),
    P('p-thisila', 'Thisila Herath', { other_sports: ['Boxing'] }),
    P('p-rohana', 'Rohana Jayawickrama', { other_sports: ['Boxing'] }),
    P('p-s1', 'Kasun Perera (sample)', { batch: 2018, joined_year: 2006 }),
    P('p-s2', 'Dinuka Silva (sample)', { batch: 2018, joined_year: 2006 }),
    P('p-s3', 'Ravindu Fernando (sample)', { batch: 2019, joined_year: 2007 }),
    P('p-s4', 'Sahan Wijesinghe (sample)', { batch: 2020, joined_year: 2008 }),
    P('p-s5', 'Nimesh Bandara (sample)', { batch: 2020, joined_year: 2008 }),
  ],
  teams: [
    T('t-u13-12', 'U13', 2012), T('t-u15-14', 'U15', 2014), T('t-u17-16', 'U17', 2016),
    T('t-1st-17', '1st XI', 2017, { coach: 'Sample Coach' }), T('t-1st-18', '1st XI', 2018, { coach: 'Sample Coach' }),
    T('t-u15-16', 'U15', 2016), T('t-1st-19', '1st XI', 2019),
  ],
  team_memberships: [
    ['p-s1', 't-u13-12'], ['p-s1', 't-u15-14'], ['p-s1', 't-u17-16'], ['p-s1', 't-1st-17'], ['p-s1', 't-1st-18', 'Captain'],
    ['p-s2', 't-u15-14'], ['p-s2', 't-1st-17'], ['p-s2', 't-1st-18', 'Vice-captain'],
    ['p-s3', 't-u17-16'], ['p-s3', 't-1st-18', 'Secretary'], ['p-s3', 't-1st-19', 'Captain'],
    ['p-s4', 't-u15-16', 'Captain'], ['p-s4', 't-1st-19'],
    ['p-s5', 't-u15-16'], ['p-s5', 't-1st-19'],
  ].map(([player_id, team_id, role], i) => ({ id: 'm' + i, player_id, team_id, role })),
  achievements: [
    { id: 'a1', player_id: 'p-roshan', title: 'Royal Colours', sport: 'Hockey', source: 'WhatsApp group, 17 Nov 2026' },
    { id: 'a2', player_id: 'p-roshan', title: 'Royal Colours', sport: 'Boxing', source: 'WhatsApp group, 17 Nov 2026' },
    { id: 'a3', player_id: 'p-thisila', title: 'Royal Colours', sport: 'Hockey', source: 'WhatsApp group, 17 Nov 2026' },
    { id: 'a4', player_id: 'p-thisila', title: 'Royal Colours', sport: 'Boxing', source: 'WhatsApp group, 17 Nov 2026' },
    { id: 'a5', player_id: 'p-rohana', title: 'Royal Colours', sport: 'Hockey', source: 'Shihar Sir, WhatsApp, 17 Nov 2026 (given as 88/89)' },
    { id: 'a6', player_id: 'p-rohana', title: 'Royal Colours', sport: 'Boxing', source: 'Shihar Sir, WhatsApp, 17 Nov 2026 (given as 88/89)' },
    { id: 'a7', player_id: 'p-s1', title: 'Royal Colours', sport: 'Hockey', level: '1st Year', season: 2017 },
    { id: 'a8', player_id: 'p-s1', title: 'Royal Colours', sport: 'Hockey', level: '2nd Year', season: 2018 },
    { id: 'a9', player_id: 'p-s2', title: 'Royal Colours', sport: 'Hockey', level: '1st Year', season: 2018 },
    { id: 'a10', player_id: 'p-s3', title: 'Best player, Schools League', sport: 'Hockey', season: 2019 },
    { id: 'a11', player_id: 'p-s1', title: 'Royal Crown', sport: 'Hockey', season: 2018 },
    { id: 'a12', player_id: 'p-s1', title: 'Colombo Schools Colours', sport: 'Hockey', season: 2018 },
  ],
  team_achievements: [
    { id: 'ta1', team_id: 't-u15-16', title: 'All-Island Championship', finish: '3rd place' },
    { id: 'ta2', team_id: 't-1st-18', title: 'League', finish: 'Runners-up' },
  ],
  venues: [
    { id: 'v1', name: 'Royal College Grounds', city: 'Colombo', surface: 'Grass' },
    { id: 'v2', name: 'Sample Astro Turf', city: 'Colombo', surface: 'Astro' },
  ],
  opponents: [{ id: 'o4', name: "S. Thomas' College, Mount Lavinia" }, { id: 'o1', name: 'Opponent A (sample)' }, { id: 'o2', name: 'Opponent B (sample)' }, { id: 'o3', name: 'Opponent C (sample)' }],
  tournaments: [{ id: 'tr3', name: 'Orville Abeynaike Memorial Trophy', level: 'Trophy match', season: 2017 }, { id: 'tr1', name: 'All-Island U15', level: 'All-Island', season: 2016 }, { id: 'tr2', name: 'Schools League', level: 'League', season: 2018 }],
  matches: [
    { id: 'mt1', team_id: 't-u15-16', opponent_id: 'o1', venue_id: 'v2', tournament_id: 'tr1', match_date: '2016-07-10', score_for: 2, score_against: 1, stage: 'Quarter-final' },
    { id: 'mt2', team_id: 't-u15-16', opponent_id: 'o2', venue_id: 'v2', tournament_id: 'tr1', match_date: '2016-07-12', score_for: 0, score_against: 1, stage: 'Semi-final' },
    { id: 'mt3', team_id: 't-u15-16', opponent_id: 'o3', venue_id: 'v2', tournament_id: 'tr1', match_date: '2016-07-13', score_for: 3, score_against: 2, stage: '3rd place' },
    { id: 'mt4', team_id: 't-1st-18', opponent_id: 'o1', venue_id: 'v1', tournament_id: 'tr2', match_date: '2018-03-04', score_for: 4, score_against: 0 },
    { id: 'mt6', team_id: 't-1st-17', opponent_id: 'o4', venue_id: 'v1', tournament_id: 'tr3', score_for: 2, score_against: 2 },
    { id: 'mt5', team_id: 't-1st-18', opponent_id: 'o2', venue_id: 'v1', tournament_id: 'tr2', match_date: '2018-03-18', score_for: 1, score_against: 1 },
  ],
  match_players: [],
  goals: [
    { id: 'g1', match_id: 'mt1', player_id: 'p-s4', kind: 'Penalty corner' }, { id: 'g2', match_id: 'mt1', player_id: 'p-s5', kind: 'Field goal' },
    { id: 'g3', match_id: 'mt3', player_id: 'p-s4', kind: 'Field goal' }, { id: 'g4', match_id: 'mt3', player_id: 'p-s4', kind: 'Penalty stroke' }, { id: 'g5', match_id: 'mt3', player_id: 'p-s5', kind: 'Field goal' },
    { id: 'g6', match_id: 'mt4', player_id: 'p-s1', kind: 'Field goal' }, { id: 'g7', match_id: 'mt4', player_id: 'p-s1', kind: 'Penalty corner' }, { id: 'g8', match_id: 'mt4', player_id: 'p-s2', kind: 'Field goal' }, { id: 'g9', match_id: 'mt4', player_id: 'p-s3', kind: 'Field goal' },
    { id: 'g10', match_id: 'mt5', player_id: 'p-s1', kind: 'Field goal' },
  ],
  milestones: [
    { id: 'ms2', season: 2016, title: 'U15 team placed 3rd at All-Island (sample)' },
  ],
}
