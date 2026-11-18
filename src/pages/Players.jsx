import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../App.jsx'
import { batchLabel } from '../data/db.js'
import { SearchIcon, initials } from '../components.jsx'

export default function Players() {
  const { db } = useData()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const list = db.players
    .filter((p) => `${p.full_name} ${p.known_as || ''} ${p.batch || ''} ${p.joined_year || ''}`.toLowerCase().includes(q.toLowerCase()))
    .filter((p) => {
      const ach = db.achievementsByPlayer[p.id] || []
      if (filter === 'colours') return ach.some((a) => a.title === 'Royal Colours' && (a.sport || 'Hockey') === 'Hockey')
      if (filter === 'crown') return ach.some((a) => a.title === 'Royal Crown')
      if (filter === 'national') return ach.some((a) => a.title === 'National Colours')
      if (filter === 'captains') return (db.membershipsByPlayer[p.id] || []).some((m) => m.role === 'Captain')
      if (filter === 'multi') return p.other_sports?.length > 0
      return true
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
  return (
    <>
      <h1>Players</h1>
      <p className="lead">Everyone who has worn the blue and gold on the hockey field. Search by name or batch year.</p>
      <div className="row">
        <div className="search-wrap"><SearchIcon /><input placeholder="Search by name or batch year" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All players</option><option value="colours">Royal Colours (hockey)</option><option value="crown">Royal Crown</option><option value="national">National Colours</option>
          <option value="captains">Captains</option><option value="multi">Also played other sports</option>
        </select>
        <span className="muted small">{list.length} shown</span>
      </div>
      <div className="grid stagger" key={q + filter}>
        {list.map((p, i) => {
          const teams = (db.membershipsByPlayer[p.id] || []).map((m) => db.team[m.team_id]).filter(Boolean)
          return (
            <Link className="card" key={p.id} to={`/players/${p.id}`} style={{ '--i': i }}>
              <div className="card-head">
                <div className="avatar">{initials(p.full_name)}</div>
                <div>
                  <b>{p.full_name}</b>{p.known_as && <span className="muted small"> ({p.known_as})</span>}
                  <div className="small muted">{batchLabel(p)} · {teams.length} team{teams.length === 1 ? '' : 's'}</div>
                </div>
              </div>
              {p.other_sports?.length > 0 && <div style={{ marginTop: '.6rem' }}>{p.other_sports.map((s) => <span key={s} className="pill">{s}</span>)}</div>}
            </Link>
          )
        })}
      </div>
      {list.length === 0 && <p className="muted">No players match that search.</p>}
    </>
  )
}
