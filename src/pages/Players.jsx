import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../App.jsx'

export default function Players() {
  const { db } = useData()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const list = db.players
    .filter((p) => `${p.full_name} ${p.known_as || ''} ${p.batch || ''}`.toLowerCase().includes(q.toLowerCase()))
    .filter((p) => {
      const ach = db.achievementsByPlayer[p.id] || []
      if (filter === 'colours') return ach.some((a) => a.title === 'Colours')
      if (filter === 'captains') return (db.membershipsByPlayer[p.id] || []).some((m) => m.role === 'Captain')
      if (filter === 'multi') return p.other_sports?.length > 0
      return true
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
  return (
    <>
      <h1>Players</h1>
      <div className="row">
        <input className="search" placeholder="Search by name or batch" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All players</option><option value="colours">Colours winners</option>
          <option value="captains">Captains</option><option value="multi">Also played other sports</option>
        </select>
        <span className="muted small">{list.length} shown</span>
      </div>
      <div className="grid">
        {list.map((p) => {
          const teams = (db.membershipsByPlayer[p.id] || []).map((m) => db.team[m.team_id]).filter(Boolean)
          return (
            <Link className="card" key={p.id} to={`/players/${p.id}`}>
              <b>{p.full_name}</b>{p.known_as && <span className="muted"> ({p.known_as})</span>}
              <div className="small muted">{p.batch || 'Batch unknown'} · {teams.length} team{teams.length === 1 ? '' : 's'}</div>
              {p.other_sports?.map((s) => <span key={s} className="pill">{s}</span>)}
            </Link>
          )
        })}
      </div>
    </>
  )
}
