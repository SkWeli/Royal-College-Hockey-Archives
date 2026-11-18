import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../App.jsx'
import { AGE_GROUPS } from '../data/db.js'
import { record } from '../components.jsx'

export default function Timeline() {
  const { db } = useData()
  const nav = useNavigate()
  const scroller = useRef()
  useEffect(() => { if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth }, []) // start at the most recent seasons
  const years = [...db.teams.map((t) => t.season), ...db.milestones.map((m) => m.season), ...db.achievements.map((a) => a.season).filter(Boolean)]
  if (!years.length) return <p className="muted">Nothing dated yet.</p>
  const y0 = Math.min(...years), y1 = Math.max(...years)
  const groups = AGE_GROUPS.filter((g) => db.teams.some((t) => t.age_group === g))
  const lanes = [...groups.slice().reverse(), 'Honours', 'Club']
  const colW = 56, left = 80, laneH = 38, top = 28
  const W = left + (y1 - y0 + 1) * colW + 20, H = top + lanes.length * laneH + 10
  const x = (y) => left + (y - y0) * colW + colW / 2
  const ly = (lane) => top + lanes.indexOf(lane) * laneH + laneH / 2
  const allYears = Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i)

  const bySeason = {}
  const push = (s, item) => (bySeason[s] ||= []).push(item)
  db.milestones.forEach((m) => push(m.season, <span key={m.id}>{m.title}</span>))
  db.teams.forEach((t) => (db.teamAchByTeam[t.id] || []).forEach((a) => push(t.season, <span key={a.id}><Link to={`/teams/${t.id}`}>{db.teamLabel(t)}</Link>: {a.title}, {a.finish}</span>)))
  db.teams.filter((t) => t.age_group === '1st XI').forEach((t) => {
    const cap = (db.membershipsByTeam[t.id] || []).find((m) => m.role === 'Captain')
    if (cap) push(t.season, <span key={'c' + t.id}>1st XI captain: <Link to={`/players/${cap.player_id}`}>{db.player[cap.player_id]?.full_name}</Link></span>)
  })
  db.achievements.filter((a) => a.season).forEach((a) => push(a.season, <span key={a.id}><Link to={`/players/${a.player_id}`}>{db.player[a.player_id]?.full_name}</Link>: {a.sport} {a.title.toLowerCase()}{a.level ? ` (${a.level})` : ''}</span>))

  return (
    <>
      <h1>Timeline</h1>
      <p className="lead">Each row is an age group. Bigger dots mean more recorded matches; a gold ring means the team won an honour. Click a dot to open the team.</p>
      <div ref={scroller} style={{ overflowX: 'auto' }}>
        <svg className="viz" width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ width: W, maxWidth: 'none' }}>
          {allYears.map((y) => (
            <g key={y}>
              <line x1={x(y)} x2={x(y)} y1={top - 4} y2={H - 6} stroke="#eef0f5" />
              <text x={x(y)} y={16} fontSize="11" textAnchor="middle" fill="#5d6475">{y}</text>
            </g>
          ))}
          {lanes.map((l) => <text key={l} x={8} y={ly(l) + 4} fontSize="12" fill="#1b1f2a">{l}</text>)}
          {db.teams.map((t) => {
            const r = record(db.matchesByTeam[t.id] || []), honour = db.teamAchByTeam[t.id]
            return (
              <circle key={t.id} className="tl-dot" cx={x(t.season)} cy={ly(t.age_group)} r={6 + Math.min(r.P, 10) * 0.7} fill="#10275e"
                stroke={honour ? '#d4a017' : '#fff'} strokeWidth={honour ? 3.5 : 1.5} onClick={() => nav(`/teams/${t.id}`)}>
                <title>{db.teamLabel(t)} · {(db.membershipsByTeam[t.id] || []).length} players{r.P ? ` · W${r.W} D${r.D} L${r.L}` : ''}{honour ? ` · ${honour.map((h) => h.finish + ' ' + h.title).join(', ')}` : ''}</title>
              </circle>
            )
          })}
          {Object.entries(db.achievements.filter((a) => a.season).reduce((m, a) => ((m[a.season] ||= []).push(a), m), {})).map(([s, list]) => (
            <g key={s}>
              <rect x={x(+s) - 7} y={ly('Honours') - 7} width="14" height="14" fill="#b4472a" transform={`rotate(45 ${x(+s)} ${ly('Honours')})`} />
              {list.length > 1 && <text x={x(+s) + 10} y={ly('Honours') - 6} fontSize="10" fill="#b4472a">{list.length}</text>}
              <title>{list.map((a) => `${db.player[a.player_id]?.full_name}: ${a.sport} ${a.title}`).join('\n')}</title>
            </g>
          ))}
          {db.milestones.map((m) => (
            <g key={m.id}><circle cx={x(m.season)} cy={ly('Club')} r="7" fill="#d4a017" /><title>{m.season}: {m.title}</title></g>
          ))}
        </svg>
      </div>
      <h2>Season by season</h2>
      {Object.keys(bySeason).sort((a, b) => b - a).map((s) => (
        <div key={s} className="card season-card" style={{ marginBottom: '.8rem' }}>
          <div className="year">{s}</div>
          <ul>{bySeason[s].map((el, i) => <li key={i}>{el}</li>)}</ul>
        </div>
      ))}
    </>
  )
}
