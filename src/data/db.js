import { useEffect as _useEffect, useState as _useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { sample } from './sample.js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/(rest\/v1)?\/?$/, '')
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && key ? createClient(url, key) : null
export const demoMode = !supabase

const TABLES = ['players', 'teams', 'team_memberships', 'achievements', 'team_achievements', 'venues',
  'opponents', 'tournaments', 'matches', 'match_players', 'goals', 'milestones']

// Loads every public table. Fine for thousands of rows; add paging if it ever grows past ~50k.
export async function loadAll() {
  if (demoMode) return structuredClone(sample)
  const out = {}
  await Promise.all(TABLES.map(async (t) => {
    const { data, error } = await supabase.from(t).select('*').limit(50000)
    if (error) throw new Error(`${t}: ${error.message}`)
    out[t] = data
  }))
  return out
}

export async function loadContact(playerId) {
  if (demoMode) return null
  const { data } = await supabase.from('contacts').select('*').eq('player_id', playerId).maybeSingle()
  return data
}

export async function insertRow(table, row) {
  if (demoMode) throw new Error('Demo mode: connect Supabase to save data (see README).')
  const { data, error } = await supabase.from(table).insert(row).select().single()
  if (error) throw new Error(error.message)
  return data
}

// Build lookup maps and derived facts once, so pages stay simple.
export function index(db) {
  const by = (arr) => Object.fromEntries(arr.map((r) => [r.id, r]))
  const group = (arr, k) => arr.reduce((m, r) => ((m[r[k]] ||= []).push(r), m), {})
  const teamLabel = (t) => (t ? `${ageLabel(t.age_group)} ${t.season}` : '')
  // Every tournament or trophy a team played appears in its season results, with its matches.
  // A trophy match with a score is its own result (Winners, Drawn or Lost). A tournament needs its final
  // result entered; until then it shows with no result. Entered season results win if both exist.
  const tournament = by(db.tournaments)
  const key = (teamId, title) => `${teamId}|${title.trim().toLowerCase()}`
  const entered = new Set(db.team_achievements.map((a) => key(a.team_id, a.title)))
  const fromMatches = {}
  for (const m of db.matches) {
    const comp = tournament[m.tournament_id]
    if (!comp || comp.level === 'Friendly') continue
    const k = key(m.team_id, comp.name)
    if (entered.has(k)) continue
    const trophy = comp.level === 'Trophy match' || trophyFor(comp.name)
    const r = trophy ? result(m) : ''
    fromMatches[k] = { id: `match-${m.id}`, team_id: m.team_id, title: comp.name, trophy: !!trophy,
      finish: r === 'W' ? 'Winners' : r === 'D' ? 'Drawn' : r === 'L' ? 'Lost' : null, match_id: m.id, fromMatch: true }
  }
  const results = [...db.team_achievements, ...Object.values(fromMatches)]
  // matches grouped by team + competition name, for showing under each season result
  const matchesByResult = {}
  for (const m of db.matches) { const c = tournament[m.tournament_id]; if (c) (matchesByResult[key(m.team_id, c.name)] ||= []).push(m) }
  return {
    ...db,
    player: by(db.players), team: by(db.teams), venue: by(db.venues),
    opponent: by(db.opponents), tournament: by(db.tournaments), match: by(db.matches),
    membershipsByPlayer: group(db.team_memberships, 'player_id'),
    membershipsByTeam: group(db.team_memberships, 'team_id'),
    achievementsByPlayer: group(db.achievements, 'player_id'),
    storedResultsByTeam: group(db.team_achievements, 'team_id'),       // season results as entered
    teamAchByTeam: group(results, 'team_id'),                          // + trophy results worked out from matches
    podiumByTeam: group(results.filter(isAchievement), 'team_id'),     // achievements only
    matchesByTeam: group(db.matches, 'team_id'),
    matchesFor: (a) => (matchesByResult[`${a.team_id}|${a.title.trim().toLowerCase()}`] || []).sort((x, y) => (x.match_date || '').localeCompare(y.match_date || '')),
    goalsByMatch: group(db.goals, 'match_id'),
    goalsByPlayer: group(db.goals, 'player_id'),
    teamLabel,
  }
}

// How a level match was settled. Empty = the draw stood.
export const DECIDERS = [['', 'Stayed a draw'], ['Penalty strokes', 'Penalty strokes (PS)'], ['Shoot-out', 'Penalty shoot-out'], ['Sudden death', 'Shoot-out, then sudden death']]
const DECIDED_AS = { 'Penalty strokes': 'on penalty strokes', 'Shoot-out': 'on shoot-out', 'Sudden death': 'in sudden death' }
export const onPenalties = (m) => m.score_for != null && m.score_for === m.score_against && !!m.decided_by && m.pen_for != null && m.pen_against != null && m.pen_for !== m.pen_against

// W / D / L. A level match won or lost on penalties counts as a win or a loss.
export const result = (m) =>
  m.score_for == null || m.score_against == null ? ''
    : m.score_for > m.score_against ? 'W' : m.score_for < m.score_against ? 'L'
    : onPenalties(m) ? (m.pen_for > m.pen_against ? 'W' : 'L') : 'D'

// "2–1", or "1–1 · won 4–3 on shoot-out"
export const scoreText = (m) => {
  const base = `${m.score_for ?? '?'}–${m.score_against ?? '?'}`
  return onPenalties(m) ? `${base} · ${m.pen_for > m.pen_against ? 'won' : 'lost'} ${m.pen_for}–${m.pen_against} ${DECIDED_AS[m.decided_by]}` : base
}

export const AGE_GROUPS = ['U9', 'U11', 'U13', 'U15', 'U17', '1st XI']
// Official way to write an age group: U15 → U-15. 1st XI stays as it is.
export const ageLabel = (g) => (/^U\d+$/.test(g || '') ? `U-${g.slice(1)}` : g || '')
export const teamTitle = (t) => (t ? `${ageLabel(t.age_group)} Hockey Team ${t.season}` : '')
export const rolesFor = (ageGroup) => (ageGroup === '1st XI' ? ['Captain', 'Vice-captain', 'Secretary'] : ['Captain', 'Vice-captain'])
// Achievement groups on the player form. roles: choices per year; ordinal: numbered 1st Year, 2nd Year…
export const HOCKEY_ACHIEVEMENTS = [
  { key: 'Royal Colours', ordinal: true },
  { key: 'Colombo Schools Colours', roles: ['Captain (Reds)', 'Vice-Captain (Reds)', 'Captain (Blues)', 'Vice-Captain (Blues)'] },
  { key: 'Sri Lanka Schools Colours', roles: ['Captain', 'Vice-Captain'] },
  { key: 'National Colours' },
  { key: 'Other', text: true },
]
export const OTHER_ACHIEVEMENTS = [
  { key: 'Royal Crown' },
  { key: 'Senior Prefect', single: true, roles: ['Head Prefect', 'Senior Deputy Head Prefect', 'Deputy Head Prefect'] },
]
export const SPORT_COLOUR_ROLES = ['Captain', 'Vice-Captain']
export const SPORTS = ['Athletics', 'Badminton', 'Basketball', 'Boxing', 'Chess', 'Cricket', 'Cycling', 'Football', 'Golf', 'Judo', 'Karate', 'Rifle Shooting', 'Rowing', 'Rugby', 'Squash', 'Swimming', 'Table Tennis', 'Taekwondo', 'Tennis', 'Volleyball', 'Water Polo', 'Wrestling']
const NON_SPORT = new Set(OTHER_ACHIEVEMENTS.map((g) => g.key))
export const MAX_YEARS = 10
// Venues offered in every match form (others typed in are added to the archive too).
export const KNOWN_VENUES = ['Astro Turf, Colombo', 'Astro Turf, Matale', 'Campbell Park', 'Colombo University Grounds', 'Edward Park Hockey Ground, Matale', 'Peradeniya University Grounds', 'RC Grounds', 'Rajarata University Grounds, Mihintale', 'SPC Grounds', 'STC Grounds', 'TCK Grounds', 'WC Grounds']
export const KNOWN_COACHES = ['Mr. Ashok Peiris', 'Mr. Damith Panditharatne', 'Mr. Mulaafar', 'Mr. Rohan Dissanayake', 'Mr. Vasantha de Silva']
// Team competitions by age group. Trophy matches are against one school.
export const TOURNAMENT_RESULTS = ['Champions', 'Runners-Up', '2nd Runners-Up', '4th Place', 'Quarter-Finals', 'Pre-Quarter-Finals', 'Group Stage']
export const TROPHY_RESULTS = ['Winners', 'Drawn', 'Lost']
export const CARNIVAL_RESULTS = ['Gold Star', 'Silver Star']
const AI = 'All-Island Schools Hockey Championship', WP = 'Western Province Hockey Championship'
export const COMPETITIONS = {
  '1st XI': {
    tournaments: ['All-Island National Schools Games', AI, WP],
    trophies: [
      { name: 'Orville Abeynaike Memorial Trophy', opponent: "S. Thomas' College, Mount Lavinia" },
      { name: 'J.C.A. Corea Memorial Trophy', opponent: 'Trinity College, Kandy' },
      { name: 'Dudley K.G. De Silva Challenge Shield', opponent: 'Wesley College, Colombo' },
      { name: 'Lennie De Silva Memorial Trophy', opponent: 'Kingswood College, Kandy' },
    ],
  },
  U17: { tournaments: [AI, WP], trophies: [] },
  U15: { tournaments: [AI, WP], trophies: [] },
  U13: { tournaments: [AI, WP, 'Western Province Hockey Carnival'], trophies: [] },
}
// Results that count as the team's achievements (shown in gold, on the timeline and in the Teams grid).
const PODIUM = new Set(['champions', 'runners-up', '2nd runners-up', '3rd place', 'winners', 'won', 'drawn', 'gold star', 'silver star'])
export const isAchievement = (a) => PODIUM.has(String(a?.finish || '').trim().toLowerCase())
export const competitionsFor = (g) => COMPETITIONS[g] || { tournaments: [], trophies: [] }
export const trophyFor = (name) => Object.values(COMPETITIONS).flatMap((c) => c.trophies).find((t) => t.name === name)
export function resultsFor(name, ageGroup) {
  if (name === 'Western Province Hockey Carnival') return CARNIVAL_RESULTS
  if (trophyFor(name)) return TROPHY_RESULTS
  if (competitionsFor(ageGroup).tournaments.includes(name)) return TOURNAMENT_RESULTS
  return [...TOURNAMENT_RESULTS, ...TROPHY_RESULTS, ...CARNIVAL_RESULTS] // a competition typed in by hand
}

// Every country name (from the browser), with Sri Lanka first.
const ISO = 'AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW'
export const COUNTRIES = (() => {
  let names
  try { const dn = new Intl.DisplayNames(['en'], { type: 'region' }); names = ISO.split(' ').map((c) => dn.of(c)) } catch { names = ['Australia', 'Canada', 'New Zealand', 'Qatar', 'United Arab Emirates', 'United Kingdom', 'United States'] }
  return ['Sri Lanka', ...names.filter((n) => n !== 'Sri Lanka').sort((a, b) => a.localeCompare(b))]
})()

export const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`
export const batchLabel = (p) => (p?.batch ? `Batch of ${p.batch}` : 'Batch unknown')
export const yearsAtRoyal = (p) => (p?.joined_year || p?.batch ? `At Royal ${p.joined_year || '?'}–${p.batch || '?'}` : '')

// How an honour is shown, e.g. "1st Year Coloursman", "Boxing: Royal Colours", "Royal Crown".
export function honourLabel(a) {
  let t = a.title === 'Royal Colours' && a.level ? `${a.level} Coloursman` : a.title === 'Senior Prefect' && a.role ? a.role : a.title
  if (a.role && a.title !== 'Senior Prefect') t += ` · ${a.role}`
  if (a.sport && a.sport !== 'Hockey') t = `${a.sport}: ${t}`
  return t
}

// Turns the structured form ({ teams: {U13: [{year, role}]}, honours: {'Royal Colours': [{year}], Other: [{year, text}]} })
// into rows ready to save. Royal Colours years are numbered in order: 1st Year, 2nd Year...
export function historyRows(history) {
  const teams = [], honours = []
  for (const [age_group, rows] of Object.entries(history?.teams || {}))
    for (const r of rows) teams.push({ age_group, season: +r.year, role: r.role || null })
  const add = (title, rows, sport, numbered) => [...rows].sort((a, b) => a.year - b.year).forEach((r, i) => honours.push({
    title: title === 'Other' ? r.text.trim() : title, season: +r.year, sport,
    level: numbered ? `${ordinal(i + 1)} Year` : null, role: r.role || null,
  }))
  for (const [title, rows] of Object.entries(history?.honours || {})) add(title, rows, NON_SPORT.has(title) ? null : 'Hockey', title === 'Royal Colours')
  for (const [title, rows] of Object.entries(history?.other || {})) add(title, rows, null, false)
  for (const s of history?.sports || []) add('Royal Colours', s.rows, s.sport === 'Other' ? s.otherSport.trim() : s.sport, true)
  return { teams, honours }
}

export function historySummary(history) {
  const { teams, honours } = historyRows(history)
  return {
    Teams: teams.map((t) => `${t.age_group} ${t.season}${t.role ? ` (${t.role})` : ''}`).join(', '),
    Achievements: honours.map((h) => `${honourLabel(h)} ${h.season}`).join(', '),
  }
}

// Team form → readable lines for the email and the admin list.
export function teamSummary(t) {
  return {
    Team: t.age_group, Year: t.season, Coach: t.coach,
    Squad: t.squad.map((p) => `${p.name}${p.batch ? ` (Batch of ${p.batch})` : ''}${p.role ? `, ${p.role}` : ''}${p.country && p.country !== 'Sri Lanka' ? `, lives in ${p.country}` : ''}`).join('\n'),
    'Season results': (t.results || []).map((r) => [
      `${r.title}${r.finish ? `: ${r.finish}` : ''}`,
      ...r.matches.map((m) => `   vs ${m.opponent}${m.score_for != null ? ` ${scoreText(m)}` : ''}${m.stage ? ` (${m.stage})` : ''}${m.match_date ? `, ${m.match_date}` : ''}`),
    ].join('\n')).join('\n'),
  }
}

const findPlayer = (db, name, batch) => {
  const n = name.trim().toLowerCase()
  const same = db.players.filter((p) => p.full_name.trim().toLowerCase() === n)
  return batch ? same.find((p) => p.batch === +batch) || same.find((p) => !p.batch) : same.length === 1 ? same[0] : same.find((p) => !p.batch)
}

// Editors only: save a team, its squad and its achievements. Players not yet in the archive are added.
export async function importTeam(db, t) {
  if (demoMode) throw new Error('Demo mode: connect Supabase to save data.')
  const row = { age_group: t.age_group, season: +t.season, ...(t.coach ? { coach: t.coach } : {}) }
  const { data: team, error } = await supabase.from('teams').upsert(row, { onConflict: 'age_group,season' }).select().single()
  if (error) throw new Error(error.message)
  let added = 0
  for (const s of t.squad) {
    let p = findPlayer(db, s.name, s.batch)
    if (!p) {
      p = await insertRow('players', { full_name: s.name.trim(), batch: s.batch ? +s.batch : null, residence_country: s.country || 'Sri Lanka' })
      db.players.push(p); added++
    } else {
      const patch = {}
      if (s.country && s.country !== p.residence_country) patch.residence_country = s.country
      if (s.batch && !p.batch) patch.batch = +s.batch
      if (Object.keys(patch).length) await supabase.from('players').update(patch).eq('id', p.id)
    }
    const { error: e2 } = await supabase.from('team_memberships').upsert({ player_id: p.id, team_id: team.id, role: s.role || null }, { onConflict: 'player_id,team_id' })
    if (e2) throw new Error(e2.message)
  }
  // Season results: one row per competition (all results kept; podium finishes show as achievements), plus its matches
  const have = new Set((db.storedResultsByTeam?.[team.id] || []).map((a) => a.title.toLowerCase()))
  let matches = 0
  for (const r of t.results || []) {
    if (r.finish && !have.has(r.title.toLowerCase())) {
      const { error: e3 } = await supabase.from('team_achievements').insert({ team_id: team.id, title: r.title, finish: r.finish, source: t.source || null })
      if (e3) throw new Error(e3.message)
      have.add(r.title.toLowerCase())
    }
    for (const m of r.matches || []) {
      await importMatch(db, { ...m, age_group: t.age_group, season: +t.season, competition: r.title === 'Friendly' ? null : r.title,
        competition_kind: trophyFor(r.title) ? 'Trophy match' : 'Tournament', source: t.source })
      matches++
    }
  }
  return { team, added, matches }
}

// Editors only: save a player with all his teams and achievements. Reuses an existing player
// (same name and batch) and existing teams, so importing twice doesn't duplicate.
export async function importPlayer(db, { player, history, source }) {
  if (demoMode) throw new Error('Demo mode: connect Supabase to save data.')
  const p = findPlayer(db, player.full_name, player.batch) || (await insertRow('players', player))
  const { teams, honours } = historyRows(history)
  for (const t of teams) {
    let team = db.teams.find((x) => x.age_group === t.age_group && x.season === t.season)
    if (!team) {
      const { data, error } = await supabase.from('teams').upsert({ age_group: t.age_group, season: t.season }, { onConflict: 'age_group,season' }).select().single()
      if (error) throw new Error(error.message)
      team = data; db.teams.push(team)
    }
    const { error } = await supabase.from('team_memberships').upsert({ player_id: p.id, team_id: team.id, role: t.role }, { onConflict: 'player_id,team_id' })
    if (error) throw new Error(error.message)
  }
  const have = new Set((db.achievementsByPlayer?.[p.id] || []).map((a) => `${a.title}|${a.season}|${a.sport ?? ''}`))
  const rows = honours.filter((h) => !have.has(`${h.title}|${h.season}|${h.sport ?? ''}`)).map((h) => ({ ...h, player_id: p.id, source: source || null }))
  if (rows.length) {
    const { error } = await supabase.from('achievements').insert(rows)
    if (error) throw new Error(error.message)
  }
  return p
}

// Public submission: saved to Supabase for review, and emailed to the admin via Web3Forms (free).
// The admin email is set in the Web3Forms account, so it never appears in this code.
const WEB3FORMS_KEY = import.meta.env.VITE_WEB3FORMS_KEY

export async function sendSubmission({ kind, details, submitter_name, submitter_contact, submitter_batch, botcheck }) {
  if (botcheck) return // hidden field filled = a spam bot; pretend it worked
  const saved = { ok: false, emailed: false }
  if (!demoMode) {
    const { error } = await supabase.from('submissions').insert({ kind, details, submitter_name, submitter_contact, submitter_batch })
    if (error) throw new Error(error.message)
    saved.ok = true
  }
  if (WEB3FORMS_KEY) {
    const lines = Object.entries(details).filter(([k, v]) => v && !k.startsWith('_')).map(([k, v]) => `${k}: ${v}`).join('\n')
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject: `Hockey archive submission: ${kind}`,
        from_name: 'Royal College Hockey Archives',
        message: `${lines}\n\nFrom: ${submitter_name}${submitter_batch ? ` (${submitter_batch})` : ''}\nContact: ${submitter_contact || '—'}\n\nReview it on the site under #/admin → Submissions.`,
      }),
    })
    const j = await res.json().catch(() => ({}))
    saved.emailed = !!j.success
    if (!j.success && !saved.ok) throw new Error(j.message || 'Could not send. Try again later.')
  }
  if (!saved.ok && !saved.emailed) throw new Error('Demo mode: submissions need Supabase or Web3Forms set up (see README).')
  return saved
}

export async function listSubmissions() {
  if (demoMode) return []
  const { data, error } = await supabase.from('submissions').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function setSubmissionStatus(id, status, admin_note) {
  const { error } = await supabase.from('submissions').update({ status, admin_note }).eq('id', id)
  if (error) throw new Error(error.message)
}

// ---------- Admin data editor ----------
// pk: the column(s) that identify a row.
export async function fetchTable(table) {
  const { data, error } = await supabase.from(table).select('*').limit(50000)
  if (error) throw new Error(error.message)
  return data
}

const where = (q, pk, row) => pk.reduce((qq, k) => qq.eq(k, row[k]), q)

export async function updateRow(table, pk, row, patch) {
  if (demoMode) throw new Error('Demo mode: connect Supabase to edit data.')
  const { data, error } = await where(supabase.from(table).update(patch), pk, row).select()
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error("Nothing was saved. Check you're signed in as an editor.")
  return data[0]
}

export async function deleteRow(table, pk, row) {
  if (demoMode) throw new Error('Demo mode: connect Supabase to delete data.')
  const { data, error } = await where(supabase.from(table).delete(), pk, row).select()
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error("Nothing was deleted. Check you're signed in as an editor.")
}

// ---------- Matches ----------
export const matchSummary = (m) => ({
  Team: `${m.age_group} ${m.season}`, Opponent: m.opponent, Date: m.match_date, Competition: m.competition, Stage: m.stage,
  Score: m.score_for != null ? `Royal ${scoreText(m)}` : '', Venue: m.venue, Scorers: m.scorers, Notes: m.notes,
})

async function findOrCreate(table, match, row) {
  const { data: found, error } = await Object.entries(match).reduce((q, [k, v]) => (v == null ? q.is(k, null) : typeof v === 'string' ? q.ilike(k, v) : q.eq(k, v)), supabase.from(table).select('*')).limit(1)
  if (error) throw new Error(error.message)
  if (found?.length) return found[0]
  return insertRow(table, row)
}

// Editors only: save a match, creating its team, opponent, venue and competition if needed.
export async function importMatch(db, m) {
  if (demoMode) throw new Error('Demo mode: connect Supabase to save data.')
  const { data: team, error } = await supabase.from('teams').upsert({ age_group: m.age_group, season: m.season }, { onConflict: 'age_group,season' }).select().single()
  if (error) throw new Error(error.message)
  const opp = await findOrCreate('opponents', { name: m.opponent }, { name: m.opponent })
  const venue = m.venue ? await findOrCreate('venues', { name: m.venue }, { name: m.venue }) : null
  const comp = m.competition ? await findOrCreate('tournaments', { name: m.competition, season: m.season }, { name: m.competition, season: m.season, level: m.competition_kind }) : null
  if (m.match_date) {
    const { data: dup } = await supabase.from('matches').select('id').eq('team_id', team.id).eq('opponent_id', opp.id).eq('match_date', m.match_date).limit(1)
    if (dup?.length) throw new Error('This match is already in the archive (same team, opponent and date).')
  }
  const notes = [m.scorers && `Scorers: ${m.scorers}`, m.notes].filter(Boolean).join('\n') || null
  return insertRow('matches', {
    team_id: team.id, opponent_id: opp.id, venue_id: venue?.id || null, tournament_id: comp?.id || null, match_date: m.match_date,
    score_for: m.score_for, score_against: m.score_against, stage: m.stage, notes, source: m.source || null,
    decided_by: m.decided_by || null, pen_for: m.pen_for ?? null, pen_against: m.pen_against ?? null,
  })
}

// ---------- Admin editing helpers ----------
export { findOrCreate }

export async function ensureTeam(age_group, season) {
  const { data, error } = await supabase.from('teams').upsert({ age_group, season: +season }, { onConflict: 'age_group,season' }).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function upsertRow(table, row, onConflict) {
  if (demoMode) throw new Error('Demo mode: connect Supabase to save data.')
  const { data, error } = await supabase.from(table).upsert(row, { onConflict }).select().single()
  if (error) throw new Error(error.message)
  return data
}

// Move everything from one player record to another, then delete the duplicate.
export async function mergePlayers(db, keepId, dupId) {
  if (demoMode) throw new Error('Demo mode: connect Supabase to merge players.')
  if (keepId === dupId) throw new Error('Choose a different player.')
  const ok = (r) => { if (r.error) throw new Error(r.error.message); return r.data }
  const keepTeams = new Map((db.membershipsByPlayer[keepId] || []).map((m) => [m.team_id, m]))
  for (const m of db.membershipsByPlayer[dupId] || []) {
    const k = keepTeams.get(m.team_id)
    if (k) {
      if (!k.role && m.role) ok(await supabase.from('team_memberships').update({ role: m.role }).eq('id', k.id))
      ok(await supabase.from('team_memberships').delete().eq('id', m.id))
    } else ok(await supabase.from('team_memberships').update({ player_id: keepId }).eq('id', m.id))
  }
  const keepMatches = new Set(db.match_players.filter((x) => x.player_id === keepId).map((x) => x.match_id))
  for (const x of db.match_players.filter((x) => x.player_id === dupId)) {
    if (keepMatches.has(x.match_id)) ok(await supabase.from('match_players').delete().eq('match_id', x.match_id).eq('player_id', dupId))
    else ok(await supabase.from('match_players').update({ player_id: keepId }).eq('match_id', x.match_id).eq('player_id', dupId))
  }
  ok(await supabase.from('achievements').update({ player_id: keepId }).eq('player_id', dupId))
  ok(await supabase.from('goals').update({ player_id: keepId }).eq('player_id', dupId))
  const { data: kc } = await supabase.from('contacts').select('player_id').eq('player_id', keepId).maybeSingle()
  if (!kc) ok(await supabase.from('contacts').update({ player_id: keepId }).eq('player_id', dupId))
  const keep = db.player[keepId], dup = db.player[dupId], fill = {}
  for (const k of ['known_as', 'joined_year', 'batch', 'bio', 'residence_country']) if (keep[k] == null && dup[k] != null) fill[k] = dup[k]
  if (!keep.other_sports?.length && dup.other_sports?.length) fill.other_sports = dup.other_sports
  if (Object.keys(fill).length) ok(await supabase.from('players').update(fill).eq('id', keepId))
  ok(await supabase.from('players').delete().eq('id', dupId))
}

// Signed-in user (or null), kept up to date.
export function useSession() {
  const [s, setS] = _useState(null)
  _useEffect(() => {
    if (demoMode) return
    supabase.auth.getSession().then(({ data }) => setS(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, x) => setS(x))
    return () => data.subscription.unsubscribe()
  }, [])
  return s
}

// ---------- Possible duplicate names ----------
// "Lithira Almeida" / "Litihira Almeida", "M. Rasanga" / "Malith Rasanga", "Chellapah" / "Chellappah".
const norm = (s) => s.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()
// Letters added, removed, changed, or two neighbouring letters swapped ("Heraht" → "Herath") each count as one.
function editDistance(a, b, max = 3) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let pp = null, prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (pp && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], pp[j - 2] + 1)
      best = Math.min(best, cur[j])
    }
    if (best > max) return max + 1
    pp = prev; prev = cur
  }
  return prev[b.length]
}
// How alike two names are: 0 = not alike, higher = more alike. Returns a short reason too.
export function nameMatch(x, y) {
  const a = norm(x), b = norm(y)
  if (!a || !b) return null
  if (a === b) return { score: 100, why: 'Same name' }
  const ta = a.split(' '), tb = b.split(' ')
  // word by word: initials must agree exactly; a word may be off by one letter (two in long words like Ramanathan)
  if (ta.length === tb.length) {
    let total = 0, ok = true
    for (let i = 0; i < ta.length && ok; i++) {
      if (ta[i] === tb[i]) continue
      if (ta[i].length === 1 || tb[i].length === 1) { ok = false; break }
      const d = editDistance(ta[i], tb[i], 2), allow = Math.min(ta[i].length, tb[i].length) >= 8 ? 2 : 1
      if (d > allow) ok = false; else total += d
    }
    if (ok && total) return { score: 90 - total * 10, why: total === 1 ? 'One letter different' : 'Two letters different' }
  }
  // same surname, and the rest fits as initials: "M. Rasanga" / "Malith Rasanga", "K. H. Jasinarachchi" / "Krishantha H. Jasinarachchi"
  const la = ta[ta.length - 1], lb = tb[tb.length - 1]
  if (la.length > 3 && (la === lb || editDistance(la, lb, 1) <= 1)) {
    const ra = ta.slice(0, -1), rb = tb.slice(0, -1)
    const short = ra.length <= rb.length ? ra : rb, long = ra.length <= rb.length ? rb : ra
    if (short.length && short.every((t, i) => long[i] && (t === long[i] || (t.length === 1 && long[i][0] === t) || (long[i].length === 1 && t[0] === long[i]))))
      return { score: 60, why: 'Same surname, matching initials' }
  }
  return null
}
export function similarPlayers(name, players, skipId) {
  return players.filter((p) => p.id !== skipId).map((p) => ({ p, m: nameMatch(name, p.full_name) }))
    .filter((x) => x.m && x.m.score < 100).sort((a, b) => b.m.score - a.m.score).slice(0, 3)
}
export function duplicatePairs(players) {
  const out = []
  for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
    const a = players[i], b = players[j]
    if (a.batch && b.batch && Math.abs(a.batch - b.batch) > 2) continue // clearly different people
    const m = nameMatch(a.full_name, b.full_name)
    if (m) out.push({ a, b, ...m })
  }
  return out.sort((x, y) => y.score - x.score)
}

// Checks and clean-up for the penalty fields (used by every match form)
export const isLevel = (m) => m.score_for !== '' && m.score_for != null && String(m.score_for) === String(m.score_against)
export function penaltyErrors(m, label = '') {
  if (!isLevel(m) || !m.decided_by) return []
  const p = (k) => m[k] !== '' && m[k] != null && Number.isInteger(+m[k]) && +m[k] >= 0
  if (!p('pen_for') || !p('pen_against')) return [`${label}enter the penalty score (Royal and opponent)`]
  if (+m.pen_for === +m.pen_against) return [`${label}the penalty score can't be level. If it went to sudden death, include those goals`]
  return []
}
export const penaltyData = (m) => (isLevel(m) && m.decided_by
  ? { decided_by: m.decided_by, pen_for: +m.pen_for, pen_against: +m.pen_against }
  : { decided_by: null, pen_for: null, pen_against: null })
