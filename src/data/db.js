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
  const teamLabel = (t) => (t ? `${t.age_group} ${t.season}` : '')
  return {
    ...db,
    player: by(db.players), team: by(db.teams), venue: by(db.venues),
    opponent: by(db.opponents), tournament: by(db.tournaments), match: by(db.matches),
    membershipsByPlayer: group(db.team_memberships, 'player_id'),
    membershipsByTeam: group(db.team_memberships, 'team_id'),
    achievementsByPlayer: group(db.achievements, 'player_id'),
    teamAchByTeam: group(db.team_achievements, 'team_id'),
    matchesByTeam: group(db.matches, 'team_id'),
    goalsByMatch: group(db.goals, 'match_id'),
    goalsByPlayer: group(db.goals, 'player_id'),
    teamLabel,
  }
}

export const result = (m) =>
  m.score_for == null || m.score_against == null ? '' : m.score_for > m.score_against ? 'W' : m.score_for < m.score_against ? 'L' : 'D'

export const AGE_GROUPS = ['U9', 'U11', 'U13', 'U15', 'U17', '1st XI']
export const rolesFor = (ageGroup) => (ageGroup === '1st XI' ? ['Captain', 'Vice-captain', 'Secretary'] : ['Captain', 'Vice-captain'])
export const HOCKEY_HONOURS = ['Royal Colours', 'Colombo Schools Colours', 'National Colours', 'Royal Crown', 'Other']
export const MAX_YEARS = 10
export const KNOWN_COACHES = ['Mr. Rohan Dissanayake']
export const TEAM_RESULTS = ['Champions', 'Runners-up', '3rd place', 'Semi-finalists', 'Quarter-finalists']

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
  let t = a.title === 'Royal Colours' && a.level ? `${a.level} Coloursman` : a.title
  if (a.sport && a.sport !== 'Hockey') t = `${a.sport}: ${t}`
  return t
}

// Turns the structured form ({ teams: {U13: [{year, role}]}, honours: {'Royal Colours': [{year}], Other: [{year, text}]} })
// into rows ready to save. Royal Colours years are numbered in order: 1st Year, 2nd Year...
export function historyRows(history) {
  const teams = [], honours = []
  for (const [age_group, rows] of Object.entries(history?.teams || {}))
    for (const r of rows) teams.push({ age_group, season: +r.year, role: r.role || null })
  for (const [title, rows] of Object.entries(history?.honours || {})) {
    const sorted = [...rows].sort((a, b) => a.year - b.year)
    sorted.forEach((r, i) => honours.push({
      title: title === 'Other' ? r.text.trim() : title,
      season: +r.year, sport: 'Hockey',
      level: title === 'Royal Colours' ? `${ordinal(i + 1)} Year` : null,
    }))
  }
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
    Achievements: t.achievements.map((a) => `${a.title}${a.finish ? `: ${a.finish}` : ''}`).join('\n'),
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
  const have = new Set((db.teamAchByTeam?.[team.id] || []).map((a) => a.title.toLowerCase()))
  const ach = t.achievements.filter((a) => !have.has(a.title.trim().toLowerCase())).map((a) => ({ team_id: team.id, title: a.title.trim(), finish: a.finish || null, source: t.source || null }))
  if (ach.length) {
    const { error: e3 } = await supabase.from('team_achievements').insert(ach)
    if (e3) throw new Error(e3.message)
  }
  return { team, added }
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
  const have = new Set((db.achievementsByPlayer?.[p.id] || []).map((a) => `${a.title}|${a.season}|${a.sport}`))
  const rows = honours.filter((h) => !have.has(`${h.title}|${h.season}|${h.sport}`)).map((h) => ({ ...h, player_id: p.id, source: source || null }))
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
