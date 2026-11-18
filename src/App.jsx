import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { demoMode, index, loadAll } from './data/db.js'
import Home from './pages/Home.jsx'
import Players from './pages/Players.jsx'
import PlayerPage from './pages/PlayerPage.jsx'
import Teams from './pages/Teams.jsx'
import TeamPage from './pages/TeamPage.jsx'
import MatchPage from './pages/MatchPage.jsx'
import { MatchesFor } from './pages/MatchesFor.jsx'
import Graph from './pages/Graph.jsx'
import Timeline from './pages/Timeline.jsx'
import Admin from './pages/Admin.jsx'
import Submit from './pages/Submit.jsx'

const DataCtx = createContext(null)
export const useData = () => useContext(DataCtx)

// Ripple on every button, .btn and clickable card, from the point the user pressed.
function useRipples() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const onDown = (e) => {
      const el = e.target.closest('button, .btn, a.card')
      if (!el || el.disabled) return
      const r = el.getBoundingClientRect(), size = Math.max(r.width, r.height)
      const s = document.createElement('span')
      s.className = 'ripple'
      s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`
      el.appendChild(s)
      setTimeout(() => s.remove(), 650)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])
}

function Crest() {
  const [ok, setOk] = useState(true)
  return ok ? <img src="./crest.png" alt="" className="crest" onError={() => setOk(false)} /> : <span className="crest-fallback">RC</span>
}

function Skeleton() {
  return (
    <div className="skeleton" aria-label="Loading">
      <div className="sk" style={{ height: 38, width: '45%' }} />
      <div className="sk" style={{ width: '70%' }} />
      <div className="grid">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="sk" style={{ height: 110, borderRadius: 14 }} />)}</div>
    </div>
  )
}

export default function App() {
  const [db, setDb] = useState(null)
  const [error, setError] = useState(null)
  const [menu, setMenu] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const loc = useLocation()
  const reload = useCallback(() => loadAll().then((d) => setDb(index(d))).catch((e) => setError(e.message)), [])
  useEffect(() => { reload() }, [reload])
  useEffect(() => { setMenu(false); window.scrollTo({ top: 0, behavior: 'instant' }) }, [loc.pathname])
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 500)
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  useRipples()
  const isHome = loc.pathname === '/'

  return (
    <DataCtx.Provider value={{ db, reload }}>
      <header className="top">
        <div className="top-inner">
          <Link to="/" className="brand"><Crest />Royal College Hockey Archives</Link>
          <button className={`menu-btn ${menu ? 'open' : ''}`} aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><span /><span /><span /></button>
          <nav className={menu ? 'open' : ''}>
            <NavLink to="/players">Players</NavLink>
            <NavLink to="/teams">Teams</NavLink>
            <NavLink to="/graph">Network</NavLink>
            <NavLink to="/timeline">Timeline</NavLink>
            <NavLink to="/submit" className="cta">Submit info</NavLink>
          </nav>
        </div>
      </header>
      {demoMode && <div className="demo">Demo mode: showing sample data. Connect Supabase to use the real archive.</div>}

      {error && <main><p className="error">Couldn't load data: {error}</p></main>}
      {!db && !error && <main><Skeleton /></main>}
      {db && (isHome ? <div className="page" key="home"><Home /></div> : (
        <main>
          <div className="page" key={loc.pathname}>
            <Routes>
              <Route path="/players" element={<Players />} />
              <Route path="/players/:id" element={<PlayerPage />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/teams/:id" element={<TeamPage />} />
              <Route path="/matches/:id" element={<MatchPage />} />
              <Route path="/opponents/:id" element={<MatchesFor kind="opponent" />} />
              <Route path="/venues/:id" element={<MatchesFor kind="venue" />} />
              <Route path="/graph" element={<Graph />} />
              <Route path="/timeline" element={<Timeline />} />
              <Route path="/submit" element={<Submit />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<><h1>Page not found</h1><Link className="btn" to="/">Back to home</Link></>} />
            </Routes>
          </div>
        </main>
      ))}

      <footer className="footer">
        <div className="footer-inner">
          <div>
            <div className="motto">Disce aut Discede</div>
            <div className="small">Royal College Hockey Archives · kept by old boys, for old boys</div>
          </div>
          <div className="small"><Link to="/submit">Submit information or a correction</Link></div>
        </div>
      </footer>
      <button className={`to-top ${scrolled ? 'show' : ''}`} aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
      </button>
    </DataCtx.Provider>
  )
}
