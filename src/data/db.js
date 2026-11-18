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
    Honours: honours.map((h) => `${honourLabel(h)} ${h.season}`).join(', '),
  }
}

// Editors only: save a player with all his teams and honours. Reuses an existing player
// (same name and batch) and existing teams, so importing twice doesn't duplicate.
export async function importPlayer(db, { player, history, source }) {
  if (demoMode) throw new Error('Demo mode: connect Supabase to save data.')
  const same = db.players.find((p) => p.full_name.trim().toLowerCase() === player.full_name.trim().toLowerCase() && (p.batch || null) === (player.batch || null))
  const p = same || (await insertRow('players', player))
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
