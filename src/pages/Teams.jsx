import { Link } from 'react-router-dom'
import { useData } from '../App.jsx'
import { AGE_GROUPS } from '../data/db.js'

export default function Teams() {
  const { db } = useData()
  const seasons = [...new Set(db.teams.map((t) => t.season))].sort((a, b) => b - a)
  const groups = AGE_GROUPS.filter((g) => db.teams.some((t) => t.age_group === g))
  const find = (g, s) => db.teams.find((t) => t.age_group === g && t.season === s)
  return (
    <>
      <h1>Teams</h1>
      <p className="lead">Every age-group team by season. A gold star means the team won an achievement that year.</p>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Season</th>{groups.map((g) => <th key={g}>{g}</th>)}</tr></thead>
          <tbody>
            {seasons.map((s) => (
              <tr key={s}>
                <td><b>{s}</b></td>
                {groups.map((g) => {
                  const t = find(g, s)
                  if (!t) return <td key={g} />
                  const n = (db.membershipsByTeam[t.id] || []).length, honours = db.teamAchByTeam[t.id]
                  return <td key={g}><Link to={`/teams/${t.id}`}>{n} players</Link>{honours && <span className="pill gold" title={honours.map((h) => `${h.title}: ${h.finish}`).join(', ')}>★</span>}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
