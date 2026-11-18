import { Link, useParams } from 'react-router-dom'
import { useData } from '../App.jsx'
import { result } from '../data/db.js'
import { PlayerLink, TeamLink } from '../components.jsx'

export default function MatchPage() {
  const { id } = useParams()
  const { db } = useData()
  const m = db.match[id]
  if (!m) return <p>Match not found.</p>
  const o = db.opponent[m.opponent_id], v = db.venue[m.venue_id], tr = db.tournament[m.tournament_id], r = result(m)
  const goals = db.goalsByMatch[id] || []
  const lineup = db.match_players.filter((x) => x.match_id === id)
  return (
    <>
      <p className="muted"><TeamLink db={db} t={db.team[m.team_id]} />{tr && ` · ${tr.name}`}{m.stage && ` · ${m.stage}`}</p>
      <h1>Royal College {m.score_for ?? '?'} – {m.score_against ?? '?'} {o ? <Link to={`/opponents/${o.id}`}>{o.name}</Link> : 'Unknown opponent'} {r && <span className={`res ${r}`}>({r})</span>}</h1>
      <p className="muted">{m.match_date || 'Date unknown'}{v && <> · <Link to={`/venues/${v.id}`}>{v.name}</Link>{v.surface ? ` (${v.surface})` : ''}</>}</p>
      {m.notes && <p>{m.notes}</p>}
      <h2>Goals</h2>
      {goals.length ? <ul>{goals.map((g) => <li key={g.id}><PlayerLink p={db.player[g.player_id]} />{g.minute ? ` ${g.minute}'` : ''}{g.kind ? ` · ${g.kind}` : ''}</li>)}</ul> : <p className="muted">No scorers recorded.</p>}
      {lineup.length > 0 && (<><h2>Line-up</h2>{lineup.map((x) => <span key={x.player_id} className="pill"><PlayerLink p={db.player[x.player_id]} />{x.role ? ` · ${x.role}` : ''}</span>)}</>)}
      {m.source && <p className="small muted">Source: {m.source}</p>}
    </>
  )
}
