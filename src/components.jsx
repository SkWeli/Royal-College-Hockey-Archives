import { Link } from 'react-router-dom'
import { result } from './data/db.js'

export const PlayerLink = ({ p }) => (p ? <Link to={`/players/${p.id}`}>{p.full_name}</Link> : <span className="muted">Unknown</span>)
export const TeamLink = ({ db, t }) => (t ? <Link to={`/teams/${t.id}`}>{db.teamLabel(t)}</Link> : null)

export function record(matches) {
  const r = { P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0 }
  for (const m of matches) {
    const x = result(m); if (!x) continue
    r.P++; r[x]++; r.GF += m.score_for; r.GA += m.score_against
  }
  return r
}

export function RecordLine({ matches }) {
  const r = record(matches)
  if (!r.P) return null
  return <p className="muted">Played {r.P} · Won {r.W} · Drew {r.D} · Lost {r.L} · Goals {r.GF}–{r.GA}</p>
}

export function MatchTable({ db, matches, showTeam = false }) {
  if (!matches?.length) return <p className="muted">No matches recorded yet.</p>
  const sorted = [...matches].sort((a, b) => (a.match_date || '').localeCompare(b.match_date || ''))
  return (
    <table>
      <thead><tr><th>Date</th>{showTeam && <th>Team</th>}<th>Opponent</th><th>Score</th><th>Competition</th><th>Venue</th></tr></thead>
      <tbody>
        {sorted.map((m) => {
          const o = db.opponent[m.opponent_id], v = db.venue[m.venue_id], tr = db.tournament[m.tournament_id], r = result(m)
          return (
            <tr key={m.id}>
              <td><Link to={`/matches/${m.id}`}>{m.match_date || 'Date unknown'}</Link></td>
              {showTeam && <td><TeamLink db={db} t={db.team[m.team_id]} /></td>}
              <td>{o ? <Link to={`/opponents/${o.id}`}>{o.name}</Link> : '—'}</td>
              <td>{r && <span className={`res ${r}`}>{r} </span>}{m.score_for ?? '?'}–{m.score_against ?? '?'}</td>
              <td>{tr?.name}{m.stage ? ` · ${m.stage}` : ''}</td>
              <td>{v ? <Link to={`/venues/${v.id}`}>{v.name}</Link> : '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
