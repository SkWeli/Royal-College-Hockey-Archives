import { Link, useParams } from 'react-router-dom'
import { useData } from '../App.jsx'
import { MatchTable, PlayerLink, RecordLine } from '../components.jsx'

export default function TeamPage() {
  const { id } = useParams()
  const { db } = useData()
  const t = db.team[id]
  if (!t) return <p>Team not found.</p>
  const squad = (db.membershipsByTeam[id] || []).map((m) => ({ ...m, p: db.player[m.player_id] }))
    .sort((a, b) => (a.role ? 0 : 1) - (b.role ? 0 : 1) || (a.p?.full_name || '').localeCompare(b.p?.full_name || ''))
  const matches = db.matchesByTeam[id] || []
  const scorers = {}
  for (const m of matches) for (const g of db.goalsByMatch[m.id] || []) if (g.player_id) scorers[g.player_id] = (scorers[g.player_id] || 0) + 1
  const sameGroup = db.teams.filter((x) => x.age_group === t.age_group).sort((a, b) => a.season - b.season)
  const i = sameGroup.findIndex((x) => x.id === id)

  return (
    <>
      <div className="row small">
        {sameGroup[i - 1] && <Link to={`/teams/${sameGroup[i - 1].id}`}>← {db.teamLabel(sameGroup[i - 1])}</Link>}
        {sameGroup[i + 1] && <Link style={{ marginLeft: 'auto' }} to={`/teams/${sameGroup[i + 1].id}`}>{db.teamLabel(sameGroup[i + 1])} →</Link>}
      </div>
      <h1>{t.age_group} team, {t.season}</h1>
      {t.coach && <p className="muted">Coach: {t.coach}</p>}
      {(db.teamAchByTeam[id] || []).map((a) => <span key={a.id} className="pill gold">{a.title}: {a.finish}</span>)}
      <h2>Squad</h2>
      {squad.length ? squad.map((m) => <span key={m.id} className="pill"><PlayerLink p={m.p} />{m.role ? ` · ${m.role}` : ''}</span>) : <p className="muted">No players recorded yet.</p>}
      <h2>Matches</h2>
      <RecordLine matches={matches} />
      <MatchTable db={db} matches={matches} />
      {Object.keys(scorers).length > 0 && (<>
        <h2>Top scorers</h2>
        {Object.entries(scorers).sort((a, b) => b[1] - a[1]).map(([pid, n]) => <span key={pid} className="pill green"><PlayerLink p={db.player[pid]} /> · {n}</span>)}
      </>)}
    </>
  )
}
