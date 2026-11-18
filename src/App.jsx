import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
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

export default function App() {
  const [db, setDb] = useState(null)
  const [error, setError] = useState(null)
  const reload = useCallback(() => loadAll().then((d) => setDb(index(d))).catch((e) => setError(e.message)), [])
  useEffect(() => { reload() }, [reload])

  return (
    <DataCtx.Provider value={{ db, reload }}>
      <header className="top">
        <NavLink to="/" className="brand"><img src="./crest.png" alt="" className="crest" onError={(e) => { e.currentTarget.style.display = 'none' }} />Royal College Hockey Archives</NavLink>
        <nav>
          <NavLink to="/players">Players</NavLink>
          <NavLink to="/teams">Teams</NavLink>
          <NavLink to="/graph">Network</NavLink>
          <NavLink to="/timeline">Timeline</NavLink>
          <NavLink to="/submit">Submit info</NavLink>
        </nav>
      </header>
      {demoMode && <div className="demo">Demo mode: showing sample data. Connect Supabase to use the real archive (see README).</div>}
      <main>
        {error && <p className="error">Couldn't load data: {error}</p>}
        {!db && !error && <p className="muted">Loading…</p>}
        {db && (
          <Routes>
            <Route path="/" element={<Home />} />
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
            <Route path="*" element={<p>Page not found.</p>} />
          </Routes>
        )}
      </main>
    </DataCtx.Provider>
  )
}
