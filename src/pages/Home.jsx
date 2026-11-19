import { Suspense, lazy, useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../App.jsx'
import { CountUp, initials } from '../components.jsx'
import { batchLabel } from '../data/db.js'

const Hero3D = lazy(() => import('../Hero3D.jsx'))

// Flat pitch in perspective: shown if the device can't draw 3D.
function Pitch() {
  return (
    <svg className="pitch" viewBox="0 0 560 320" aria-hidden="true">
      <rect className="turf" x="20" y="20" width="520" height="280" rx="6" />
      <rect className="line" x="20" y="20" width="520" height="280" rx="6" />
      <path className="line" d="M280 20 V300 M150 20 V300 M410 20 V300" />
      <path className="line" d="M20 95 A 65 65 0 0 1 20 225 M540 95 A 65 65 0 0 0 540 225" />
      <path className="line" d="M20 140 h-10 v40 h10 M540 140 h10 v40 h-10" />
      <circle className="line" cx="280" cy="160" r="4" />
      <circle className="ball" r="7" />
    </svg>
  )
}

export default function Home() {
  const { db } = useData()
  const colourSports = (p) => [...new Set((db.achievementsByPlayer[p.id] || []).filter((a) => a.title === 'Royal Colours').map((a) => a.sport || 'Hockey'))]
  const multi = db.players.filter((p) => colourSports(p).length > 1)
  const seasons = db.teams.map((t) => t.season)
  const span = seasons.length ? Math.max(...seasons) - Math.min(...seasons) + 1 : 0
  const [flat, setFlat] = useState(false)
  const fail = useCallback(() => setFlat(true), [])

  return (
    <>
      <section className="hero">
        {flat
          ? <div className="hero-canvas fallback"><Pitch /></div>
          : <Suspense fallback={<div className="hero-canvas" />}><Hero3D onFail={fail} /></Suspense>}
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="eyebrow">Royal College, Colombo</div>
            <h1>Every player, every match, <em className="gold-text">every achievement.</em></h1>
            <p>The shared history of Royal College hockey, from the U9s to the 1st XI. Built by old boys, one memory and one scorebook at a time.</p>
            <div className="row">
              <Link className="btn gold" to="/players">Explore players</Link>
              <Link className="btn outline" to="/submit">Add what you remember</Link>
            </div>
          </div>
        </div>
        <div className="hero-hint" aria-hidden="true"><i />Scroll</div>
      </section>

      <main>
        <div className="stats float stagger">
          {[[db.players.length, 'Players'], [db.teams.length, 'Teams'], [db.matches.length, 'Matches'], [db.achievements.length + db.team_achievements.length, 'Achievements'], [span, 'Seasons covered']].map(([n, l], i) => (
            <div key={l} className="stat" style={{ '--i': i }}><b><CountUp to={n} /></b><span>{l}</span></div>
          ))}
        </div>

        {multi.length > 0 && (<>
          <h2>Colours in more than one sport</h2>
          <div className="grid stagger">
            {multi.map((p, i) => (
              <Link className="card" key={p.id} to={`/players/${p.id}`} style={{ '--i': i }}>
                <div className="card-head">
                  <div className="avatar">{initials(p.full_name)}</div>
                  <div><b>{p.full_name}</b><div className="small muted">{batchLabel(p)}</div></div>
                </div>
                <div style={{ marginTop: '.7rem' }}>{colourSports(p).map((s) => <span key={s} className="pill gold">{s}: Royal Colours</span>)}</div>
              </Link>
            ))}
          </div>
        </>)}

        <h2>Explore the archive</h2>
        <div className="grid stagger">
          {[['/graph', 'Network graph', 'See how players, teams and achievements connect across the years.'],
            ['/timeline', 'Timeline', 'Every age group, season by season.'],
            ['/teams', 'Teams', 'Squads, captains and results from U9 to the 1st XI.'],
            ['/submit', 'Submit information', 'Send a missing player, match or achievement, or a correction.']].map(([to, t, d], i) => (
            <Link key={to} className="card" to={to} style={{ '--i': i }}><b>{t}</b><div className="small muted" style={{ marginTop: '.3rem' }}>{d}</div></Link>
          ))}
        </div>
      </main>
    </>
  )
}
