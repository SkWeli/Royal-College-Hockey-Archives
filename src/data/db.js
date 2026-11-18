import { createClient } from '@supabase/supabase-js'
import { sample } from './sample.js'

const url = import.meta.env.VITE_SUPABASE_URL
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

export const AGE_GROUPS = ['U9', 'U11', 'U13', 'U15', 'U17', 'U19', '2nd XI', '1st XI']
