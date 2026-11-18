import { useEffect, useState } from 'react'
import { useData } from '../App.jsx'
import { AGE_GROUPS, demoMode, insertRow, supabase } from '../data/db.js'

// Each form: table name + fields. type 'ref' renders a dropdown of existing rows.
const FORMS = (db) => {
  const players = db.players.map((p) => [p.id, `${p.full_name}${p.batch ? ` (${p.batch})` : ''}`]).sort((a, b) => a[1].localeCompare(b[1]))
  const teams = db.teams.map((t) => [t.id, db.teamLabel(t)]).sort((a, b) => a[1].localeCompare(b[1]))
  const list = (rows) => rows.map((r) => [r.id, r.name])
  return {
    Player: { table: 'players', fields: [['full_name', 'Full name', 'text', true], ['known_as', 'Known as'], ['batch', 'Batch (e.g. 88/89)'], ['other_sports', 'Other sports (comma separated)', 'list'], ['bio', 'Short bio', 'textarea']] },
    Team: { table: 'teams', fields: [['age_group', 'Age group', AGE_GROUPS.map((g) => [g, g]), true], ['season', 'Season (year)', 'number', true], ['coach', 'Coach'], ['notes', 'Notes', 'textarea']] },
    'Player in team': { table: 'team_memberships', fields: [['player_id', 'Player', players, true], ['team_id', 'Team', teams, true], ['role', 'Role', [['', 'Player'], ['Captain', 'Captain'], ['Vice-captain', 'Vice-captain']]], ['position', 'Position']] },
    'Player honour': { table: 'achievements', fields: [['player_id', 'Player', players, true], ['title', 'Honour (e.g. Colours)', 'text', true], ['sport', 'Sport', 'text'], ['level', 'Level (e.g. 1st year, 2nd year, National)'], ['season', 'Season', 'number'], ['source', 'Source (who told us / where)']] },
    'Team honour': { table: 'team_achievements', fields: [['team_id', 'Team', teams, true], ['title', 'Competition', 'text', true], ['finish', 'Placing (e.g. Champions, 3rd place)'], ['source', 'Source']] },
    Match: { table: 'matches', fields: [['team_id', 'Royal team', teams, true], ['opponent_id', 'Opponent', list(db.opponents)], ['venue_id', 'Venue', list(db.venues)], ['tournament_id', 'Competition', db.tournaments.map((t) => [t.id, `${t.name} ${t.season || ''}`])], ['match_date', 'Date', 'date'], ['score_for', 'Royal goals', 'number'], ['score_against', 'Opponent goals', 'number'], ['stage', 'Stage (e.g. Final)'], ['notes', 'Notes', 'textarea'], ['source', 'Source (e.g. Daily News, 12 Mar 1989)']] },
    Goal: { table: 'goals', fields: [['match_id', 'Match', db.matches.map((m) => [m.id, `${m.match_date || '?'} ${db.teamLabel(db.team[m.team_id])} vs ${db.opponent[m.opponent_id]?.name || '?'}`]), true], ['player_id', 'Scorer', players], ['minute', 'Minute', 'number'], ['kind', 'Type', [['', '—'], ['Field goal', 'Field goal'], ['Penalty corner', 'Penalty corner'], ['Penalty stroke', 'Penalty stroke']]]] },
    Opponent: { table: 'opponents', fields: [['name', 'School or club', 'text', true]] },
    Venue: { table: 'venues', fields: [['name', 'Name', 'text', true], ['city', 'City'], ['surface', 'Surface', [['', '—'], ['Grass', 'Grass'], ['Astro', 'Astro']]]] },
    Competition: { table: 'tournaments', fields: [['name', 'Name', 'text', true], ['level', 'Level', [['', '—'], ['League', 'League'], ['All-Island', 'All-Island'], ['Big match', 'Big match'], ['Friendly', 'Friendly']]], ['season', 'Season', 'number']] },
    'Club milestone': { table: 'milestones', fields: [['season', 'Season', 'number', true], ['event_date', 'Exact date', 'date'], ['title', 'What happened', 'text', true], ['details', 'Details', 'textarea'], ['source', 'Source']] },
    'Contact (private)': { table: 'contacts', fields: [['player_id', 'Player', players, true], ['phone', 'Phone'], ['email', 'Email'], ['city', 'City'], ['consent', 'They agreed to share this with members', 'checkbox', true]] },
  }
}

function Login() {
  const [email, setEmail] = useState(''), [msg, setMsg] = useState('')
  const send = async (e) => {
    e.preventDefault()
    if (!email.includes('@')) return setMsg('Enter a valid email address.')
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } })
    setMsg(error ? error.message : 'Check your email for a sign-in link.')
  }
  return (
    <form className="stack" onSubmit={send}>
      <p className="muted">Editors sign in with a one-time link sent to their email.</p>
      <label>Email<input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setMsg('') }} placeholder="name@example.com" /></label>
      <button>Send sign-in link</button>
      {msg && <p className="small">{msg}</p>}
    </form>
  )
}

function EntryForm({ spec, onSaved }) {
  const [vals, setVals] = useState({}), [msg, setMsg] = useState(null)
  const set = (k, v) => { setVals((s) => ({ ...s, [k]: v })); setMsg(null) }
  const submit = async (e) => {
    e.preventDefault()
    const missing = spec.fields.filter(([k, , , req]) => req && (vals[k] === undefined || vals[k] === '' || vals[k] === false))
    if (missing.length) return setMsg({ err: `Fill in: ${missing.map((f) => f[1]).join(', ')}` })
    const row = {}
    for (const [k, , type] of spec.fields) {
      let v = vals[k]
      if (v === undefined || v === '') continue
      if (type === 'number') v = Number(v)
      if (type === 'list') v = v.split(',').map((s) => s.trim()).filter(Boolean)
      row[k] = v
    }
    try { await insertRow(spec.table, row); setVals({}); setMsg({ ok: 'Saved.' }); onSaved() } catch (err) { setMsg({ err: err.message }) }
  }
  return (
    <form className="stack" onSubmit={submit}>
      {spec.fields.map(([k, label, type = 'text', req]) => (
        <label key={k}>{label}{req ? ' *' : ''}
          {Array.isArray(type) ? (
            <select value={vals[k] || ''} onChange={(e) => set(k, e.target.value)}><option value="">Choose…</option>{type.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          ) : type === 'textarea' ? <textarea rows="3" value={vals[k] || ''} onChange={(e) => set(k, e.target.value)} />
            : type === 'checkbox' ? <input type="checkbox" checked={!!vals[k]} onChange={(e) => set(k, e.target.checked)} style={{ justifySelf: 'start' }} />
            : <input type={type === 'list' ? 'text' : type} value={vals[k] || ''} onChange={(e) => set(k, e.target.value)} />}
        </label>
      ))}
      <button>Save</button>
      {msg?.err && <p className="error small">{msg.err}</p>}
      {msg?.ok && <p className="ok small">{msg.ok}</p>}
    </form>
  )
}

export default function Admin() {
  const { db, reload } = useData()
  const [session, setSession] = useState(null)
  const [tab, setTab] = useState('Player')
  useEffect(() => {
    if (demoMode) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  const forms = FORMS(db)
  return (
    <>
      <h1>Add data</h1>
      {demoMode && <p className="demo" style={{ borderRadius: 8 }}>You can try the forms, but saving needs Supabase connected (see README).</p>}
      {!demoMode && !session ? <Login /> : (
        <>
          {session && <p className="small muted">Signed in as {session.user.email} · <a href="#" onClick={(e) => { e.preventDefault(); supabase.auth.signOut() }}>Sign out</a></p>}
          <p className="small muted">Tip: add the team and opponent first, then the match, then its goals.</p>
          <div className="tabs">{Object.keys(forms).map((k) => <button key={k} className={k === tab ? 'on' : 'ghost'} onClick={() => setTab(k)}>{k}</button>)}</div>
          <EntryForm key={tab} spec={forms[tab]} onSaved={reload} />
        </>
      )}
    </>
  )
}
