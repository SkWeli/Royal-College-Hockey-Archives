import { AGE_GROUPS, competitionsFor, trophyFor } from './data/db.js'
import { CompetitionSelect } from './TeamFields.jsx'

// Shared by the public Submit form and the admin match form.
export const emptyMatch = () => ({ age_group: '', season: '', opponent: '', match_date: '', competition: '', customComp: false, stage: '', score_for: '', score_against: '', venue: '', scorers: '', notes: '' })
const thisYear = new Date().getFullYear()

export function validateMatch(m) {
  const errs = []
  if (!m.age_group) errs.push('Team: choose the team')
  if (!m.season) errs.push('Year: enter the year')
  else if (!Number.isInteger(+m.season) || +m.season < 1835 || +m.season > thisYear) errs.push(`Year: ${m.season} isn't a valid year`)
  if (m.opponent.trim().length < 3) errs.push('Opponent: enter the school or club')
  if (m.match_date && m.season && +m.match_date.slice(0, 4) !== +m.season) errs.push(`Date: ${m.match_date} isn't in ${m.season}`)
  if (m.customComp && m.competition.trim().length < 3) errs.push('Tournament or trophy: type its name')
  const sf = m.score_for !== '', sa = m.score_against !== ''
  if (sf !== sa) errs.push('Score: enter both scores, or leave both empty')
  for (const [k, l] of [['score_for', 'Royal goals'], ['score_against', 'Opponent goals']]) {
    if (m[k] !== '' && (!Number.isInteger(+m[k]) || +m[k] < 0 || +m[k] > 50)) errs.push(`${l}: ${m[k]} isn't a valid score`)
  }
  return errs
}

const kindOf = (m) => (trophyFor(m.competition) ? 'Trophy match' : m.competition === 'Friendly' ? 'Friendly' : m.competition ? 'Tournament' : null)

export const matchData = (m) => ({
  age_group: m.age_group, season: +m.season, opponent: m.opponent.trim(), match_date: m.match_date || null,
  competition: m.competition.trim() || null, competition_kind: kindOf(m), stage: m.stage.trim() || null,
  score_for: m.score_for === '' ? null : +m.score_for, score_against: m.score_against === '' ? null : +m.score_against,
  venue: m.venue.trim() || null, scorers: m.scorers.trim() || null, notes: m.notes.trim() || null,
})
export const matchForm = (d) => ({
  ...emptyMatch(), ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v ?? ''])),
  customComp: !!d.competition && d.competition !== 'Friendly' && !competitionsFor(d.age_group).tournaments.includes(d.competition) && !trophyFor(d.competition),
})

export default function MatchFields({ value: m, onChange, db }) {
  const set = (patch) => onChange({ ...m, ...patch })
  const opponents = [...new Set([...(db?.opponents || []).map((o) => o.name), ...AGE_GROUPS.flatMap((g) => competitionsFor(g).trophies.map((t) => t.opponent))])].sort()
  const venues = (db?.venues || []).map((v) => v.name).sort()
  return (
    <>
      <div className="two">
        <label>Royal team *
          <select value={m.age_group} onChange={(e) => set({ age_group: e.target.value })}>
            <option value="">Choose a team…</option>
            {AGE_GROUPS.map((g) => <option key={g} value={g}>{g === '1st XI' ? '1st XI' : `${g} team`}</option>)}
          </select>
        </label>
        <label>Year *<input type="number" inputMode="numeric" placeholder="2019" value={m.season} onChange={(e) => set({ season: e.target.value })} /></label>
      </div>
      <label>Tournament or trophy
        <div className="rowcard-line">
          <CompetitionSelect ageGroup={m.age_group} value={m.competition} custom={m.customComp} allowFriendly
            onChange={({ title, custom }) => { const t = trophyFor(title); set({ competition: title, customComp: custom, ...(t && !m.opponent ? { opponent: t.opponent } : {}) }) }} />
        </div>
      </label>
      <datalist id="known-opponents">{opponents.map((o) => <option key={o} value={o} />)}</datalist>
      <datalist id="known-venues">{venues.map((v) => <option key={v} value={v} />)}</datalist>
      <div className="two">
        <label>Opponent *<input list="known-opponents" placeholder="S. Thomas' College, Mount Lavinia" value={m.opponent} onChange={(e) => set({ opponent: e.target.value })} /></label>
        <label>Date (if you remember)<input type="date" value={m.match_date} onChange={(e) => set({ match_date: e.target.value })} /></label>
      </div>
      <div className="two">
        <label>Royal goals<input type="number" inputMode="numeric" min="0" placeholder="2" value={m.score_for} onChange={(e) => set({ score_for: e.target.value })} /></label>
        <label>Opponent goals<input type="number" inputMode="numeric" min="0" placeholder="1" value={m.score_against} onChange={(e) => set({ score_against: e.target.value })} /></label>
      </div>
      <div className="two">
        <label>Stage (e.g. Final, Semi-final)<input value={m.stage} onChange={(e) => set({ stage: e.target.value })} /></label>
        <label>Venue<input list="known-venues" value={m.venue} onChange={(e) => set({ venue: e.target.value })} /></label>
      </div>
      <label>Royal goalscorers<textarea rows="2" placeholder="e.g. Senuda Weliwatta 2, Karim Ishak" value={m.scorers} onChange={(e) => set({ scorers: e.target.value })} /></label>
      <label>Notes<textarea rows="2" value={m.notes} onChange={(e) => set({ notes: e.target.value })} /></label>
    </>
  )
}
