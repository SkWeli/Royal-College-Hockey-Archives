import { Link } from 'react-router-dom'
import { useData } from '../App.jsx'
import { AGE_GROUPS, ageLabel } from '../data/db.js'

// The gold star is only for winning the All-Island or the National Schools championship.
const STAR_EVENTS = ['All-Island Schools Hockey Championship', 'National Schools Knockout Tournament']
const wonStar = (results = []) => results.filter((a) => a.finish === 'Champions' && STAR_EVENTS.includes(a.title))

export default function Teams() {
  const { db } = useData()
  const seasons = [...new Set(db.teams.map((t) => t.season))].sort((a, b) => b - a)
  const groups = AGE_GROUPS.filter((g) => db.teams.some((t) => t.age_group === g))
  const find = (g, s) => db.teams.find((t) => t.age_group === g && t.season === s)
  return (
    <>
      <h1>Teams</h1>
      <p className="lead">Every age-group team by season. A gold star means the team won the All-Island or National Schools championship that year.</p>
      <div className="scroll-x teams-table">
        <table>
          <thead><tr><th>Season</th>{groups.map((g) => <th key={g}>{ageLabel(g)}</th>)}</tr></thead>
          <tbody>
            {seasons.map((s) => (
              <tr key={s}>
                <td><b>{s}</b></td>
                {groups.map((g) => {
                  const t = find(g, s)
                  if (!t) return <td key={g} />
                  const n = (db.membershipsByTeam[t.id] || []).length, honours = wonStar(db.teamAchByTeam[t.id])
                  return <td key={g}><Link to={`/teams/${t.id}`}>{n} players</Link>{honours.length > 0 && <span className="pill gold" title={honours.map((h) => `${h.title}: ${h.finish}`).join(', ')}>★</span>}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Phones: one card per season */}
      <div className="season-cards stagger">
        {seasons.map((s, i) => (
          <div key={s} className="card" style={{ '--i': i }}>
            <div className="yr">{s}</div>
            {groups.map((g) => {
              const t = find(g, s)
              if (!t) return null
              const n = (db.membershipsByTeam[t.id] || []).length, star = wonStar(db.teamAchByTeam[t.id]).length > 0
              return <Link key={g} className={`pill ${star ? 'gold' : ''}`} to={`/teams/${t.id}`}>{ageLabel(g)} · {n} players{star ? ' ★' : ''}</Link>
            })}
          </div>
        ))}
      </div>
    </>
  )
}
