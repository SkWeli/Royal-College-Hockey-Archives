import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// A short guided tour for first-time visitors. It opens each page in turn and explains what it shows.
// Shown once (remembered in this browser); replay it from the footer's "Take the tour".
const KEY = 'rchc-tour-done'
const STEPS = [
  { path: '/', title: 'Welcome to the Royal College Hockey Archives',
    text: 'The shared record of Royal College hockey: every player, team, match and achievement, from the U9s to the 1st XI. This quick tour shows you around. It takes under a minute.' },
  { path: '/', nav: null, title: 'The archive at a glance',
    text: 'The home page counts everything in the archive so far: players, teams, matches, achievements and the seasons covered.',
    points: ['Players with Royal Colours in more than one sport are listed here', 'Shortcuts take you to every part of the archive'] },
  { path: '/players', nav: '/players', title: 'Players',
    text: 'Every old boy in the archive. Search by name or nickname and filter by batch.',
    points: ['Open a player to see every team he played in, with his roles', 'His colours, honours and goals are listed on his page'] },
  { path: '/teams', nav: '/teams', title: 'Teams',
    text: 'Every age group, season by season, from U9 to the 1st XI.',
    points: ['A gold star marks All-Island or National Schools champions', 'Open a team for its achievements, squad (captain first) and season results'] },
  { path: '/graph', nav: '/graph', title: 'Network',
    text: 'See how players, teams and competitions connect across the years.',
    points: ['Drag to move, scroll or pinch to zoom', 'Search for a name to light up every match'] },
  { path: '/timeline', nav: '/timeline', title: 'Timeline',
    text: 'The history of Royal hockey season by season, for every age group.',
    points: ['Gold marks a season with an achievement', 'Click a season to open that team'] },
  { path: '/submit', nav: '/submit', title: 'Add what you remember',
    text: 'Know a player, result or achievement that is missing, or spotted a mistake? Send it here.',
    points: ['Tell us about yourself or a teammate', 'The admin checks every submission before it goes on the site'] },
  { path: '/', title: "You're all set",
    text: 'Start exploring. You can take this tour again any time from "Take the tour" at the bottom of every page.' },
]

const store = { get: () => { try { return localStorage.getItem(KEY) } catch { return '1' } }, set: () => { try { localStorage.setItem(KEY, '1') } catch { /* private mode */ } } }

export default function Tour() {
  const [i, setI] = useState(-1) // -1 = closed
  const nav = useNavigate()
  const loc = useLocation()
  const card = useRef(null)

  const open = useCallback(() => setI(0), [])
  const close = useCallback(() => { store.set(); setI(-1) }, [])

  // First visit: open automatically (never over the admin pages).
  useEffect(() => {
    if (!store.get() && !loc.pathname.startsWith('/admin')) { const t = setTimeout(open, 600); return () => clearTimeout(t) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // "Take the tour" anywhere on the site
  useEffect(() => { window.addEventListener('rchc:tour', open); return () => window.removeEventListener('rchc:tour', open) }, [open])

  const step = STEPS[i]
  // Go to the step's page and highlight its link in the top menu.
  useEffect(() => {
    if (!step) return
    if (loc.pathname !== step.path) nav(step.path)
    // a data attribute, not a class: React resets the link's class when the page changes
    const clear = () => document.querySelectorAll('[data-tour-spot]').forEach((el) => el.removeAttribute('data-tour-spot'))
    clear()
    if (step.nav) document.querySelector(`header.top nav a[href="#${step.nav}"]`)?.setAttribute('data-tour-spot', '')
    card.current?.focus()
    return clear
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (d) => { const n = i + d; if (n < 0) return; if (n >= STEPS.length) { close(); nav('/'); return } setI(n) }
  useEffect(() => {
    if (!step) return
    const onKey = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!step) return null
  const first = i === 0, last = i === STEPS.length - 1
  return (
    <div className={`tour ${first || last ? 'center' : ''}`} role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-backdrop" onClick={close} />
      <div className="tour-card" ref={card} tabIndex={-1} key={i}>
        {first || last ? <div className="tour-crest"><img src="./crest.png" alt="" /></div> : <div className="tour-step">Step {i} of {STEPS.length - 2}</div>}
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.text}</p>
        {step.points && <ul>{step.points.map((p) => <li key={p}>{p}</li>)}</ul>}
        <div className="tour-dots" aria-hidden="true">{STEPS.map((_, j) => <span key={j} className={j === i ? 'on' : j < i ? 'done' : ''} />)}</div>
        <div className="tour-actions">
          {first ? <button type="button" className="ghost" onClick={close}>Skip</button>
            : !last && <button type="button" className="ghost" onClick={() => go(-1)}>Back</button>}
          {!first && !last && <button type="button" className="link-btn" onClick={close}>End tour</button>}
          <button type="button" className="gold" onClick={() => go(1)}>{first ? 'Show me around' : last ? 'Start exploring' : 'Next'}</button>
        </div>
      </div>
    </div>
  )
}
