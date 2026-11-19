import { Link, useParams } from 'react-router-dom'
import { useData } from '../App.jsx'
import { EditLink } from '../components.jsx'
import { MatchTable, PlayerLink, RecordLine } from '../components.jsx'
import { batchLabel, isAchievement, teamTitle, trophyFor } from '../data/db.js'

const resultsTrophy = (a) => !!trophyFor(a.title)

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
      <EditLink to={`/admin/team/${id}`} />
      <div className="team-title"><div className="eyebrow">Royal College</div><h1>{teamTitle(t)}</h1></div>
      {t.coach && <p className="muted">Coach: {t.coach}</p>}
      {(db.podiumByTeam[id] || []).length > 0 && (<>
        <h2>Achievements</h2>
        <div className="honour-list stagger" style={{ maxWidth: 720 }}>
          {db.podiumByTeam[id].map((a, i) => (
            <div key={a.id} className="honour" style={{ '--i': i }}>
              <span className="medal" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" /></svg>
              </span>
              <div><b>{a.finish}</b><div className="small muted">{a.title}</div></div>
              {a.fromMatch && <Link className="small" style={{ marginLeft: 'auto' }} to={`/matches/${a.match_id}`}>View match</Link>}
            </div>
          ))}
        </div>
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
      <h2>Season results</h2>
      <RecordLine matches={matches} />
      {(() => {
        // how the team finished in each tournament (podium finishes are listed under Achievements too)
        const done = (db.teamAchByTeam[id] || []).filter((a) => a.finish && !a.trophy && !resultsTrophy(a))
        return done.length > 0 && <p className="small">{done.map((a) => <span key={a.id} className={`pill ${isAchievement(a) ? 'gold' : ''}`}>{a.title}: {a.finish}</span>)}</p>
      })()}
      <MatchTable db={db} matches={matches} />
      {Object.keys(scorers).length > 0 && (<>
        <h2>Top scorers</h2>
        {Object.entries(scorers).sort((a, b) => b[1] - a[1]).map(([pid, n]) => <span key={pid} className="pill green"><PlayerLink p={db.player[pid]} /> · {n}</span>)}
      </>)}
    </>
  )
}
