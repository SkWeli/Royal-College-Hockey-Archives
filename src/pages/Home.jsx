import { Link } from 'react-router-dom'
import { useData } from '../App.jsx'

export default function Home() {
  const { db } = useData()
  const multi = db.players.filter((p) => new Set((db.achievementsByPlayer[p.id] || []).filter((a) => a.title === 'Colours').map((a) => a.sport)).size > 1)
  const seasons = db.teams.map((t) => t.season)
  return (
    <>
      <h1>Royal College Hockey Archives</h1>
      <p className="muted">A shared record of every player, team, match and honour in Royal College hockey, from U9 to the 1st XI.</p>
      <div className="stats">
        <div className="stat"><b>{db.players.length}</b><span>Players</span></div>
        <div className="stat"><b>{db.teams.length}</b><span>Teams</span></div>
        <div className="stat"><b>{db.matches.length}</b><span>Matches</span></div>
        <div className="stat"><b>{db.achievements.length + db.team_achievements.length}</b><span>Honours</span></div>
        {seasons.length > 0 && <div className="stat"><b>{Math.min(...seasons)}–{Math.max(...seasons)}</b><span>Seasons covered</span></div>}
      </div>
      <h2>Colours in more than one sport</h2>
      <div className="grid">
        {multi.map((p) => (
          <div className="card" key={p.id}>
            <Link to={`/players/${p.id}`}><b>{p.full_name}</b></Link>
            <div className="small muted">{p.batch || 'Batch unknown'}</div>
            {[...new Set(db.achievementsByPlayer[p.id].filter((a) => a.title === 'Colours').map((a) => a.sport))].map((s) => <span key={s} className="pill gold">{s} colours</span>)}
          </div>
        ))}
      </div>
      <h2>Explore</h2>
      <div className="grid">
        <Link className="card" to="/graph"><b>Network graph</b><div className="small muted">See how players, teams and honours connect.</div></Link>
        <Link className="card" to="/timeline"><b>Timeline</b><div className="small muted">Every age group, season by season.</div></Link>
        <Link className="card" to="/submit"><b>Submit information</b><div className="small muted">Send a missing player, match or honour, or a correction.</div></Link>
      </div>
    </>
  )
}
