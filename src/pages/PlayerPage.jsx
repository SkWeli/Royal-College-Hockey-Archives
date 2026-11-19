import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useData } from '../App.jsx'
import { EditLink } from '../components.jsx'
import { AGE_GROUPS, ageLabel, batchLabel, demoMode, honourLabel, loadContact, yearsAtRoyal } from '../data/db.js'
import { TeamLink, initials } from '../components.jsx'

function Journey({ db, teams, achievements }) {
  const years = [...teams.map((t) => t.season), ...achievements.map((a) => a.season).filter(Boolean)]
  if (!years.length) return <p className="muted">No seasons recorded yet.</p>
  const y0 = Math.min(...years), y1 = Math.max(...years)
  const groups = AGE_GROUPS.filter((g) => teams.some((t) => t.age_group === g))
  const W = 760, left = 70, top = 24, laneH = 30
  const x = (y) => left + (y1 === y0 ? (W - left - 30) / 2 : ((y - y0) / (y1 - y0)) * (W - left - 30))
  const H = top + (groups.length + 1) * laneH + 10
  return (
    <svg className="viz" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Player journey by season">
      {Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i).map((y) => (
        <g key={y}><line x1={x(y)} x2={x(y)} y1={top - 6} y2={H - 6} stroke="#eef0f5" /><text x={x(y)} y={14} fontSize="11" textAnchor="middle" fill="#5d6475">{y}</text></g>
      ))}
      {groups.map((g, i) => {
        const yy = top + i * laneH + laneH / 2
        const ts = teams.filter((t) => t.age_group === g)
        return (
          <g key={g}>
            <text x={8} y={yy + 4} fontSize="12" fill="#1b1f2a">{ageLabel(g)}</text>
            {ts.map((t) => (
              <Link key={t.id} to={`/teams/${t.id}`}>
                <circle cx={x(t.season)} cy={yy} r={t.role === 'Captain' ? 9 : 7} className="tl-dot" fill="#10275e" stroke={t.role === 'Captain' ? '#f2b705' : 'none'} strokeWidth="3" style={{ animation: `rise .5s var(--ease) ${i * 60}ms both` }}><title>{db.teamLabel(t)}{t.role ? ` (${t.role})` : ''}</title></circle>
              </Link>
            ))}
          </g>
        )
      })}
      <text x={8} y={top + groups.length * laneH + laneH / 2 + 4} fontSize="12" fill="#1b1f2a">Achievements</text>
      {achievements.filter((a) => a.season).map((a, i) => (
        <rect key={a.id} x={x(a.season) - 6 + (i % 3) * 4} y={top + groups.length * laneH + laneH / 2 - 6} width="12" height="12" transform={`rotate(45 ${x(a.season) + (i % 3) * 4} ${top + groups.length * laneH + laneH / 2})`} fill="#d4a017"><title>{a.season}: {honourLabel(a)}</title></rect>
      ))}
    </svg>
  )
}

export default function PlayerPage() {
  const { id } = useParams()
  const { db } = useData()
  const p = db.player[id]
  const [contact, setContact] = useState(undefined)
  useEffect(() => { loadContact(id).then(setContact) }, [id])
  if (!p) return <p>Player not found.</p>

  const mems = db.membershipsByPlayer[id] || []
  const teams = mems.map((m) => ({ ...db.team[m.team_id], role: m.role })).filter((t) => t.id).sort((a, b) => a.season - b.season)
  const ach = db.achievementsByPlayer[id] || []
  const goals = db.goalsByPlayer[id] || []
  const apps = new Set([...db.match_players.filter((x) => x.player_id === id).map((x) => x.match_id), ...goals.map((g) => g.match_id)])
  const teammates = new Map()
  for (const m of mems) for (const o of db.membershipsByTeam[m.team_id] || []) if (o.player_id !== id) teammates.set(o.player_id, (teammates.get(o.player_id) || 0) + 1)

  return (
    <>
      <EditLink to={`/admin/player/${id}`} />
      <div className="profile-head">
        <div className="avatar">{initials(p.full_name)}</div>
        <div>
          <h1>{p.full_name}{p.known_as && <span className="muted" style={{ fontSize: '.6em' }}> ({p.known_as})</span>}</h1>
          <p className="muted" style={{ margin: '.3rem 0 0' }}>{[batchLabel(p), yearsAtRoyal(p), p.residence_country && `Lives in ${p.residence_country}`].filter(Boolean).join(' · ')}{p.other_sports?.length ? ` · Also: ${p.other_sports.join(', ')}` : ''}</p>
        </div>
      </div>
      {p.bio && <p>{p.bio}</p>}
      <div className="stats stagger">
        <div className="stat" style={{ "--i": 0 }}><b>{teams.length}</b><span>Teams</span></div>
        <div className="stat"><b>{apps.size}</b><span>Recorded matches</span></div>
        <div className="stat"><b>{goals.length}</b><span>Goals</span></div>
        <div className="stat"><b>{ach.length}</b><span>Achievements</span></div>
      </div>
      <h2>Journey</h2>
      <Journey db={db} teams={teams} achievements={ach} />
      <h2>Teams</h2>
      {teams.length ? teams.map((t) => <span key={t.id} className="pill"><TeamLink db={db} t={t} />{t.role ? ` · ${t.role}` : ''}</span>) : <p className="muted">None recorded yet.</p>}
      <h2>Achievements</h2>
      {ach.length ? (
        <div className="honour-list stagger">
          {[...ach].sort((a, b) => (a.season || 0) - (b.season || 0)).map((a, i) => (
            <div key={a.id} className="honour" style={{ '--i': i }}>
              <span className="medal" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="9" r="6" /><path d="M8.5 14 7 22l5-3 5 3-1.5-8" /></svg>
              </span>
              <div><b>{honourLabel(a)}</b>{a.source && <div className="small muted">Source: {a.source}</div>}</div>
              <span className="yr">{a.season || ''}</span>
            </div>
          ))}
        </div>
      ) : <p className="muted">None recorded yet.</p>}
      {teammates.size > 0 && (<>
        <h2>Teammates</h2>
        {[...teammates].sort((a, b) => b[1] - a[1]).map(([pid, n]) => <span key={pid} className="pill"><Link to={`/players/${pid}`}>{db.player[pid]?.full_name}</Link> · {n}</span>)}
      </>)}
      <h2>Contact</h2>
      {demoMode ? <p className="muted">Contacts are only shown to signed-in members once Supabase is connected.</p>
        : contact ? <p>{contact.phone} {contact.email} {contact.city}</p>
        : <p className="muted">Sign in as a member to see contact details (shown only where the person has agreed).</p>}
    </>
  )
}
