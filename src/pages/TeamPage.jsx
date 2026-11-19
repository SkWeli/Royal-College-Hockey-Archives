import { Link, useParams } from 'react-router-dom'
import { useData } from '../App.jsx'
import { MatchTable, PlayerLink, RecordLine } from '../components.jsx'
import { batchLabel, isAchievement, teamTitle } from '../data/db.js'

// Captain, vice-captain and secretary first; then seniors (earlier batch) first; unknown batch last.
const ROLE_ORDER = { Captain: 0, 'Vice-captain': 1, Secretary: 2 }

export default function TeamPage() {
  const { id } = useParams()
  const { db } = useData()
  const t = db.team[id]
  if (!t) return <p>Team not found.</p>
  const squad = (db.membershipsByTeam[id] || []).map((m) => ({ ...m, p: db.player[m.player_id] }))
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9)
      || (a.p?.batch ?? 9999) - (b.p?.batch ?? 9999)
      || (a.p?.full_name || '').localeCompare(b.p?.full_name || ''))
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
      <div className="team-title"><div className="eyebrow">Royal College</div><h1>{teamTitle(t)}</h1></div>
      {t.coach && <p className="muted">Coach: {t.coach}</p>}
      {(db.podiumByTeam[id] || []).map((a) => <span key={a.id} className="pill gold">{a.title}: {a.finish}</span>)}
      {(db.teamAchByTeam[id] || []).length > 0 && (<>
        <h2>Season results</h2>
        <table className="results-table">
          <thead><tr><th>Tournament or trophy</th><th>Result</th></tr></thead>
          <tbody>{db.teamAchByTeam[id].map((a) => <tr key={a.id}><td>{a.title}</td><td>{isAchievement(a) ? <span className="pill gold" style={{ margin: 0 }}>{a.finish}</span> : a.finish}</td></tr>)}</tbody>
        </table>
      </>)}
      <h2>Squad</h2>
      {squad.length ? (
        <div className="squad stagger">
          {squad.map((m, i) => (
            <div key={m.id} className={`squad-row ${m.role ? 'officer' : ''}`} style={{ '--i': i }}>
              <span className="n">{i + 1}</span>
              <span className="who"><PlayerLink p={m.p} />{m.p?.batch && <span className="small muted">{batchLabel(m.p)}</span>}</span>
              {m.role ? <span className="role-badge">{m.role}</span> : <span />}
            </div>
          ))}
        </div>
      ) : <p className="muted">No players recorded yet.</p>}
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
