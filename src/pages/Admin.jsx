import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useData } from '../App.jsx'
import { Browse, Duplicates, MatchEditor, PlayerEditor, TeamEditor } from './AdminEditors.jsx'
import { batchLabel, demoMode, importMatch, importPlayer, importTeam, insertRow, listSubmissions, setSubmissionStatus, supabase, upsertRow } from '../data/db.js'
import DataEditor from './DataEditor.jsx'
import { MultiMatchFields, emptyMatches, matchData, matchesForm, validateMatches } from '../MatchFields.jsx'
import TeamFields, { emptyTeam, teamData, teamForm, validateTeam } from '../TeamFields.jsx'
import HistoryFields, { PlayerBasics, emptyHistory, normalizeHistory, emptyPlayer, playerRow, validateHistory, validatePlayer } from '../HistoryFields.jsx'

// Each form: table name + fields. type 'ref' renders a dropdown of existing rows.
const FORMS = () => {
  return {
    Opponent: { table: 'opponents', fields: [['name', 'School or club', 'text', true]] },
    Venue: { table: 'venues', fields: [['name', 'Name', 'text', true], ['city', 'City'], ['surface', 'Surface', [['', '—'], ['Grass', 'Grass'], ['Astro', 'Astro']]]] },
    Competition: { table: 'tournaments', fields: [['name', 'Name', 'text', true], ['level', 'Type', [['', '—'], ['Tournament', 'Tournament'], ['Trophy match', 'Trophy match'], ['Friendly', 'Friendly']]], ['season', 'Season', 'number']] },
    'Club milestone': { table: 'milestones', fields: [['season', 'Season', 'number', true], ['event_date', 'Exact date', 'date'], ['title', 'What happened', 'text', true], ['details', 'Details', 'textarea'], ['source', 'Source']] },
  }
}

function Login() {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const send = async (e) => {
    e.preventDefault()
    if (!email.includes('@') || !password) return setMsg('Enter your email and password.')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setMsg('Wrong email or password.')
  }
  return (
    <form className="stack form-card" onSubmit={send} style={{ maxWidth: 440 }}>
      <p className="muted">Admin sign-in</p>
      <label>Email<input type="email" autoComplete="username" value={email} onChange={(e) => { setEmail(e.target.value); setMsg('') }} /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setMsg('') }} /></label>
      <button className="gold" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      {msg && <p className="error small">{msg}</p>}
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

// Add a player with all his teams and achievements in one go.
const toForm = (p) => ({ full_name: p.full_name || '', known_as: p.known_as || '', joined_year: p.joined_year ?? '', batch: p.batch ?? '', other_sports: (p.other_sports || []).join(', '), bio: p.bio || '', residence_country: p.residence_country || 'Sri Lanka' })

function PlayerForm({ db, onSaved, initial, onDone }) {
  const [player, setPlayer] = useState(initial?.player || emptyPlayer())
  const [history, setHistory] = useState(initial?.history ? normalizeHistory(initial.history) : emptyHistory())
  const [source, setSource] = useState(initial?.source || '')
  const [st, setSt] = useState({})
  const save = async (e) => {
    e.preventDefault()
    const errs = [...validatePlayer(player), ...validateHistory(history, player)]
    if (errs.length) { setSt({ errs }); setTimeout(() => document.querySelector('.errors')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); return }
    setSt({ busy: true })
    try {
      const p = await importPlayer(db, { player: playerRow(player), history, source: source.trim() })
      // He sent his own email / WhatsApp: keep them in the private contacts table (members only).
      if (initial?.contact) await upsertRow('contacts', { player_id: p.id, ...initial.contact, consent: true, updated_at: new Date().toISOString() }, 'player_id')
      setSt({ ok: `Saved ${p.full_name}.` }); setPlayer(emptyPlayer()); setHistory(emptyHistory()); setSource('')
      onSaved(); onDone?.()
    } catch (err) { setSt({ err: err.message }) }
  }
  return (
    <form className="stack" onSubmit={save} style={{ maxWidth: 'none' }}>
      <PlayerBasics players={db.players} value={player} onChange={(v) => { setPlayer(v); setSt({}) }} bioLabel="Short bio" />
      <HistoryFields value={history} onChange={(v) => { setHistory(v); setSt({}) }} />
      <label>Source (who told us, or where it's from)<input value={source} onChange={(e) => setSource(e.target.value)} /></label>
      {initial?.contact && <p className="small muted">Private contact he sent: {[initial.contact.email, initial.contact.phone].filter(Boolean).join(' · ')}. It is saved to Contacts (members only) with the player.</p>}
      {st.errs && <div className="errors" role="alert">Please fix these:<ul>{st.errs.map((x) => <li key={x}>{x}</li>)}</ul></div>}
      <button className="gold" disabled={st.busy}>{st.busy ? 'Saving…' : 'Save player'}</button>
      {st.err && <p className="error small">{st.err}</p>}
      {st.ok && <p className="ok small">{st.ok}</p>}
      <p className="small muted">If a player with the same name and batch already exists, his teams and achievements are added to that player instead of creating a new one.</p>
    </form>
  )
}

// Add or update a team with its squad and season results (and their matches). New players are created.
function TeamForm({ db, onSaved, initial, onDone }) {
  const [team, setTeam] = useState(initial?.team ? teamForm(initial.team) : emptyTeam())
  const [source, setSource] = useState(initial?.source || '')
  const [st, setSt] = useState({})
  const save = async (e) => {
    e.preventDefault()
    const errs = validateTeam(team)
    if (errs.length) { setSt({ errs }); setTimeout(() => document.querySelector('.errors')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); return }
    setSt({ busy: true })
    try {
      const { team: t, added, matches } = await importTeam(db, { ...teamData(team), source: source.trim() })
      setSt({ ok: `Saved ${t.age_group} ${t.season}${added ? `, with ${added} new player${added === 1 ? '' : 's'}` : ''}${matches ? ` and ${matches} match${matches === 1 ? '' : 'es'}` : ''}.` })
      setTeam(emptyTeam()); setSource(''); onSaved(); onDone?.()
    } catch (err) { setSt({ err: err.message }) }
  }
  return (
    <form className="stack" onSubmit={save} style={{ maxWidth: 'none' }}>
      <TeamFields db={db} value={team} onChange={(v) => { setTeam(v); setSt({}) }} />
      <label>Source (who told us, or where it's from)<input value={source} onChange={(e) => setSource(e.target.value)} /></label>
      {st.errs && <div className="errors" role="alert">Please fix these:<ul>{st.errs.map((x) => <li key={x}>{x}</li>)}</ul></div>}
      <button className="gold" disabled={st.busy}>{st.busy ? 'Saving…' : 'Save team'}</button>
      {st.err && <p className="error small">{st.err}</p>}
      {st.ok && <p className="ok small">{st.ok}</p>}
      <p className="small muted">If this team and year already exist, the squad and season results are added to it. Players are matched by name (and batch, if given); anyone not found is added as a new player.</p>
    </form>
  )
}

// Add one or more matches. Their team, opponent, venue and competition are created if new.
function MatchForm({ db, onSaved, initial, onDone }) {
  const [matches, setMatches] = useState(initial ? matchesForm(initial) : emptyMatches())
  const [source, setSource] = useState(initial?.source || '')
  const [st, setSt] = useState({})
  const save = async (e) => {
    e.preventDefault()
    const errs = validateMatches(matches)
    if (errs.length) { setSt({ errs }); setTimeout(() => document.querySelector('.errors')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); return }
    setSt({ busy: true })
    let saved = 0
    try {
      for (const m of matches) { await importMatch(db, { ...matchData(m), source: source.trim() }); saved++ }
      setSt({ ok: `Saved ${saved} match${saved === 1 ? '' : 'es'}.` }); setMatches(emptyMatches()); setSource('')
      onSaved(); onDone?.()
    } catch (err) {
      // keep the ones not yet saved on screen, so nothing is entered twice
      setMatches(matches.slice(saved)); if (saved) onSaved()
      setSt({ err: `${saved ? `Saved ${saved}, then stopped: ` : ''}${err.message}` })
    }
  }
  return (
    <form className="stack" onSubmit={save} style={{ maxWidth: 'none' }}>
      <MultiMatchFields db={db} value={matches} onChange={(v) => { setMatches(v); setSt({}) }} />
      <label>Source (who told us, or where it's from)<input value={source} onChange={(e) => setSource(e.target.value)} /></label>
      {st.errs && <div className="errors" role="alert">Please fix these:<ul>{st.errs.map((x) => <li key={x}>{x}</li>)}</ul></div>}
      <button className="gold" disabled={st.busy}>{st.busy ? 'Saving…' : matches.length > 1 ? `Save ${matches.length} matches` : 'Save match'}</button>
      {st.err && <p className="error small">{st.err}</p>}
      {st.ok && <p className="ok small">{st.ok}</p>}
      <p className="small muted">Goalscorers are saved in the match notes. To link goals to players, open the match from the Matches tab.</p>
    </form>
  )
}

function Submissions({ db, onSaved }) {
  const [rows, setRows] = useState(null), [err, setErr] = useState(''), [show, setShow] = useState('pending')
  const [open, setOpen] = useState(null)
  const load = () => listSubmissions().then(setRows).catch((e) => setErr(e.message))
  useEffect(() => { load() }, [])
  const mark = async (r, status) => {
    const note = status === 'rejected' ? (window.prompt?.('Reason (optional)') ?? '') : r.admin_note
    try { await setSubmissionStatus(r.id, status, note || null); load() } catch (e) { setErr(e.message) }
  }
  if (err) return <p className="error">{err}</p>
  if (!rows) return <p className="muted">Loading…</p>
  const list = rows.filter((r) => r.status === show)
  return (
    <>
      <div className="row">
        {['pending', 'approved', 'rejected'].map((s) => <button key={s} className={s === show ? 'on' : 'ghost'} onClick={() => setShow(s)}>{s[0].toUpperCase() + s.slice(1)} ({rows.filter((r) => r.status === s).length})</button>)}
      </div>
      {!list.length && <p className="muted">Nothing here.</p>}
      {list.map((r) => (
        <div key={r.id} className="card" style={{ marginBottom: '.8rem' }}>
          <b>{r.kind}</b> <span className="small muted">· {new Date(r.created_at).toLocaleString()} · from {r.submitter_name}{r.submitter_batch ? ` (${r.submitter_batch})` : ''}{r.submitter_contact ? ` · ${r.submitter_contact}` : ''}</span>
          <table style={{ margin: '.6rem 0' }}><tbody>
            {Object.entries(r.details).filter(([k, v]) => v && !k.startsWith('_')).map(([k, v]) => <tr key={k}><th style={{ width: '35%' }}>{k}</th><td style={{ whiteSpace: 'pre-wrap' }}>{v}</td></tr>)}
          </tbody></table>
          {r.admin_note && <p className="small muted">Note: {r.admin_note}</p>}
          {r.status === 'pending' && <div className="row" style={{ margin: 0 }}>
            {r.details._data
              ? <button className="gold" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Close' : 'Review and add to archive'}</button>
              : <button onClick={() => mark(r, 'approved')}>Approve</button>}
            <button className="ghost" onClick={() => mark(r, 'rejected')}>Reject</button>
            {!r.details._data && <span className="small muted">Approve marks it done; add the details with the forms in the other tabs.</span>}
          </div>}
          {open === r.id && (
            <div className="form-card" style={{ marginTop: '1rem', maxWidth: 'none' }}>
              <p className="small muted">Check and correct the details, then save. The submission is marked approved once saved.</p>
              {(r.details._data.matches || r.details._data.match)
                ? <MatchForm db={db} onSaved={onSaved} onDone={() => { setOpen(null); mark(r, 'approved') }} initial={{ ...r.details._data, source: `Submitted by ${r.submitter_name}` }} />
                : r.details._data.team
                ? <TeamForm db={db} onSaved={onSaved} onDone={() => { setOpen(null); mark(r, 'approved') }} initial={{ team: r.details._data.team, source: `Submitted by ${r.submitter_name}` }} />
                : <PlayerForm db={db} onSaved={onSaved} onDone={() => { setOpen(null); mark(r, 'approved') }}
                    initial={{ player: toForm(r.details._data.player), history: r.details._data.history, contact: r.details._data.contact, source: `Submitted by ${r.submitter_name}` }} />}
            </div>
          )}
        </div>
      ))}
    </>
  )
}

const TABS = ['Submissions', 'Players', 'Teams', 'Matches', 'Duplicates', 'Add new', 'All data']
const ADD = ['Player', 'Team', 'Matches', 'Opponent', 'Venue', 'Competition', 'Club milestone']

export default function Admin() {
  const { db, reload } = useData()
  const { kind, id } = useParams()
  const nav = useNavigate()
  const [session, setSession] = useState(null)
  const [tab, setTab] = useState(() => { try { return sessionStorage.getItem('admin-tab') || 'Submissions' } catch { return 'Submissions' } })
  const [add, setAdd] = useState('Player')
  useEffect(() => {
    if (demoMode) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  const pick = (t) => { setTab(t); try { sessionStorage.setItem('admin-tab', t) } catch { /* private mode */ } if (kind) nav('/admin') }
  const forms = FORMS()
  const card = (el) => <div className="form-card" style={{ maxWidth: 1040 }}>{el}</div>

  if (!demoMode && !session) return (<><h1>Admin</h1><Login /></>)
  return (
    <>
      <div className="row" style={{ marginBottom: '.4rem' }}>
        <h1 style={{ margin: 0 }}>Admin</h1>
        {session && <span className="small muted" style={{ marginLeft: 'auto' }}>Signed in as {session.user.email} · <a href="#" onClick={(e) => { e.preventDefault(); supabase.auth.signOut() }}>Sign out</a></span>}
      </div>
      {demoMode && <p className="demo" style={{ borderRadius: 8 }}>Demo mode: you can look around, but saving needs Supabase connected.</p>}
      <div className="tabs">{TABS.map((k) => <button key={k} className={!kind && k === tab ? 'on' : 'ghost'} onClick={() => pick(k)}>{k}</button>)}</div>
      {kind === 'player' ? <PlayerEditor db={db} id={id} reload={reload} />
        : kind === 'team' ? <TeamEditor db={db} id={id} reload={reload} />
        : kind === 'match' ? <MatchEditor db={db} id={id} reload={reload} />
        : tab === 'Submissions' ? <Submissions db={db} onSaved={reload} />
        : tab === 'Players' ? <Browse db={db} kind="players" />
        : tab === 'Teams' ? <Browse db={db} kind="teams" />
        : tab === 'Matches' ? <Browse db={db} kind="matches" />
        : tab === 'Duplicates' ? <Duplicates db={db} reload={reload} />
        : tab === 'All data' ? <DataEditor db={db} onChanged={reload} />
        : (<>
          <div className="row">
            <label className="inline">Add a new
              <select value={add} onChange={(e) => setAdd(e.target.value)}>{ADD.map((a) => <option key={a}>{a}</option>)}</select>
            </label>
            <span className="small muted">To change something that's already in the archive, open it from Players, Teams or Matches.</span>
          </div>
          {add === 'Player' ? card(<PlayerForm db={db} onSaved={reload} />)
            : add === 'Team' ? card(<TeamForm db={db} onSaved={reload} />)
            : add === 'Matches' ? card(<MatchForm db={db} onSaved={reload} />)
            : card(<EntryForm key={add} spec={forms[add]} onSaved={reload} />)}
        </>)}
    </>
  )
}
