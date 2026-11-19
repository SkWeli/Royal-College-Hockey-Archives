import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AGE_GROUPS, COUNTRIES, HOCKEY_ACHIEVEMENTS, KNOWN_COACHES, KNOWN_VENUES, OTHER_ACHIEVEMENTS, SPORTS, ageLabel, batchLabel, competitionsFor,
  deleteRow, ensureTeam, findOrCreate, honourLabel, insertRow, isAchievement, mergePlayers, resultsFor, rolesFor, supabase,
  teamTitle, updateRow, upsertRow, demoMode,
} from '../data/db.js'
import { SearchIcon, initials } from '../components.jsx'

// ---------- Building blocks ----------
// field: { k, label, type: text|number|date|textarea|select|check, options: [value] or [[value, label]], list: [suggestions], w: grid width }
const opt = (o) => (Array.isArray(o) ? o : [o, o || '—'])
let listId = 0

function Input({ f, value, set, adding }) {
  const id = useMemo(() => (f.list ? `dl-${++listId}` : null), [f.list])
  const v = value ?? ''
  if (f.type === 'select') return <select aria-label={f.label} value={v} onChange={(e) => set(e.target.value || null)}>{f.options.map((o) => { const [val, l] = opt(o); return <option key={val} value={val}>{adding && val === '' && (l === '—' || l === '') ? f.label : l}</option> })}</select>
  if (f.type === 'textarea') return <textarea aria-label={f.label} rows="2" value={v} onChange={(e) => set(e.target.value)} />
  if (f.type === 'check') return <input aria-label={f.label} type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} style={{ width: 20, height: 20 }} />
  return (
    <>
      <input aria-label={f.label} type={f.type || 'text'} inputMode={f.type === 'number' ? 'numeric' : undefined} list={id || undefined} placeholder={f.ph || (adding ? f.label + (f.req ? ' *' : '') : undefined)} value={v} onChange={(e) => set(e.target.value)} />
      {id && <datalist id={id}>{f.list.map((x) => <option key={x} value={x} />)}</datalist>}
    </>
  )
}

const clean = (fields, vals) => Object.fromEntries(fields.filter((f) => !f.readOnly).map((f) => {
  let v = vals[f.k]
  if (f.type === 'number') v = v === '' || v == null ? null : Number(v)
  else if (typeof v === 'string') v = v.trim() === '' ? null : v.trim()
  return [f.k, v ?? (f.type === 'check' ? false : null)]
}))

function check(fields, row) {
  for (const f of fields) {
    if (f.req && (row[f.k] == null || row[f.k] === '')) return `${f.label} is required.`
    if (f.type === 'number' && row[f.k] != null && !Number.isFinite(row[f.k])) return `${f.label} must be a number.`
  }
  return null
}

const cols = (fields, extra = '') => ({ gridTemplateColumns: `${extra}${fields.map((f) => `minmax(0, ${f.w || 1}fr)`).join(' ')} auto` })

// One saved row you can change in place. Save appears when something changed; delete asks first.
function EditRow({ fields, row, onSave, onDelete, lead, run }) {
  const [vals, setVals] = useState(row)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => setVals(row), [row])
  const patch = clean(fields, vals)
  const base = clean(fields, row)
  const dirty = Object.keys(patch).some((k) => JSON.stringify(patch[k]) !== JSON.stringify(base[k]))
  return (
    <div className={`ed-row ${dirty ? 'dirty' : ''}`} style={cols(fields, lead ? 'minmax(0, 1.4fr) ' : '')}>
      {lead && <div className="ed-lead">{lead}</div>}
      {fields.map((f) => <div key={f.k} data-l={f.label}>{f.readOnly ? <span className="ro">{f.show ? f.show(row) : row[f.k]}</span> : <Input f={f} value={vals[f.k]} set={(v) => setVals((s) => ({ ...s, [f.k]: v }))} />}</div>)}
      <div className="ed-actions">
        {confirm ? (<>
          <button type="button" className="danger" onClick={() => run(() => onDelete(row), 'Deleted.')}>Delete</button>
          <button type="button" className="ghost" onClick={() => setConfirm(false)}>Keep</button>
        </>) : (<>
          {dirty && <button type="button" className="gold" onClick={() => { const e = check(fields, patch); e ? run(() => { throw new Error(e) }) : run(() => onSave(patch), 'Saved.') }}>Save</button>}
          {dirty && <button type="button" className="ghost" onClick={() => setVals(row)}>Undo</button>}
          {onDelete && !dirty && <button type="button" className="ghost icon-btn" aria-label="Delete" onClick={() => setConfirm(true)}><Bin /></button>}
        </>)}
      </div>
    </div>
  )
}

// Empty row at the bottom of a list, for adding one more.
function AddRow({ fields, onAdd, run, label = 'Add', lead }) {
  const blank = () => Object.fromEntries(fields.map((f) => [f.k, f.def ?? '']))
  const [vals, setVals] = useState(blank)
  const add = () => {
    const row = clean(fields, vals), e = check(fields, row)
    run(async () => { if (e) throw new Error(e); await onAdd(row); setVals(blank()) }, 'Added.')
  }
  return (
    <div className="ed-row add" style={cols(fields, lead ? 'minmax(0, 1.4fr) ' : '')}>
      {lead && <div className="ed-lead muted small">{lead}</div>}
      {fields.map((f) => <div key={f.k} data-l={f.label}>{f.readOnly ? <span /> : <Input adding f={f} value={vals[f.k]} set={(v) => setVals((s) => ({ ...s, [f.k]: v }))} />}</div>)}
      <div className="ed-actions"><button type="button" className="ghost" onClick={add}><Plus /> {label}</button></div>
    </div>
  )
}

function Heads({ fields, lead }) {
  return <div className="ed-head" style={cols(fields, lead ? 'minmax(0, 1.4fr) ' : '')}>{lead && <span>{lead}</span>}{fields.map((f) => <span key={f.k}>{f.label}{f.req ? ' *' : ''}</span>)}<span /></div>
}

function Section({ title, count, children, hint }) {
  return (
    <section className="ed-section">
      <h2>{title}{count != null && <span className="count">{count}</span>}</h2>
      {hint && <p className="small muted" style={{ marginTop: '-.4rem' }}>{hint}</p>}
      {children}
    </section>
  )
}

function useRunner(reload) {
  const [msg, setMsg] = useState(null)
  const run = async (fn, ok) => {
    try { await fn(); if (ok) { setMsg({ ok }); setTimeout(() => setMsg(null), 2200) }; reload() } catch (e) { setMsg({ err: e.message }) }
  }
  const Toast = () => msg && <div className={`toast ${msg.err ? 'bad' : ''}`} role="status">{msg.err || msg.ok}{msg.err && <button className="ghost" onClick={() => setMsg(null)}>×</button>}</div>
  return { run, Toast }
}

const Bin = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
const Plus = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>

const playerName = (p) => (p ? `${p.full_name}${p.batch ? ` (${batchLabel(p)})` : ''}` : '')
const matchName = (db, m) => `${m.match_date || 'Date unknown'} · ${db.teamLabel(db.team[m.team_id])} vs ${db.opponent[m.opponent_id]?.name || '?'}`
const ROLE_OPTS = (g) => [['', 'Player'], ...rolesFor(g).map((r) => [r, r])]
const ACH_TITLES = [...HOCKEY_ACHIEVEMENTS.filter((g) => g.key !== 'Other').map((g) => g.key), ...OTHER_ACHIEVEMENTS.map((g) => g.key)]
const ACH_ROLES = [...new Set([...HOCKEY_ACHIEVEMENTS, ...OTHER_ACHIEVEMENTS].flatMap((g) => g.roles || []).concat(['Captain', 'Vice-Captain']))]
const LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year']
const KINDS = [['', '—'], 'Field goal', 'Penalty corner', 'Penalty stroke']

function Back({ to, label }) { return <Link className="small" to={to}>← {label}</Link> }

// Matches played in one tournament or trophy, shown under its season result.
function MatchList({ db, matches }) {
  if (!matches.length) return null
  return (
    <div className="result-matches">
      {matches.map((m) => (
        <Link key={m.id} to={`/admin/match/${m.id}`}>
          vs {db.opponent[m.opponent_id]?.name || '?'} · {m.score_for ?? '?'}–{m.score_against ?? '?'}{m.stage ? ` · ${m.stage}` : ''}{m.match_date ? ` · ${m.match_date}` : ''}
        </Link>
      ))}
    </div>
  )
}

// ---------- Player ----------
export function PlayerEditor({ db, id, reload }) {
  const nav = useNavigate()
  const { run, Toast } = useRunner(reload)
  const [contact, setContact] = useState(undefined)
  const [mergeWith, setMergeWith] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  useEffect(() => {
    if (demoMode) return setContact(null)
    supabase.from('contacts').select('*').eq('player_id', id).maybeSingle().then(({ data }) => setContact(data || null))
  }, [id, db])
  const p = db.player[id]
  if (!p) return <p>Player not found. <Link to="/admin">Back to admin</Link></p>

  const details = [
    { k: 'full_name', label: 'Full name', req: true, w: 2 }, { k: 'known_as', label: 'Known as' },
    { k: 'joined_year', label: 'Joined', type: 'number' }, { k: 'batch', label: 'Batch (left)', type: 'number' },
    { k: 'residence_country', label: 'Lives in', type: 'select', options: ['', ...COUNTRIES], w: 1.3 },
  ]
  const mems = (db.membershipsByPlayer[id] || []).map((m) => ({ ...m, team: db.team[m.team_id] })).sort((a, b) => (a.team?.season || 0) - (b.team?.season || 0))
  const ach = [...(db.achievementsByPlayer[id] || [])].sort((a, b) => (a.season || 0) - (b.season || 0))
  const goals = (db.goalsByPlayer[id] || []).map((g) => ({ ...g, m: db.match[g.match_id] }))
  const myTeamIds = new Set(mems.map((m) => m.team_id))
  const matchOpts = [['', 'Choose a match…'], ...db.matches.filter((m) => myTeamIds.has(m.team_id)).sort((a, b) => (b.match_date || '').localeCompare(a.match_date || '')).map((m) => [m.id, matchName(db, m)])]

  const achFields = [
    { k: 'title', label: 'Achievement', req: true, list: ACH_TITLES, w: 1.6 },
    { k: 'sport', label: 'Sport', list: ['Hockey', ...SPORTS], ph: 'Hockey', def: 'Hockey' },
    { k: 'level', label: 'Year no.', list: LEVELS, ph: '1st Year' },
    { k: 'role', label: 'Role', list: ACH_ROLES, w: 1.3 },
    { k: 'season', label: 'Year', type: 'number' },
    { k: 'source', label: 'Source', w: 1.2 },
  ]

  return (
    <div className="editor">
      <Toast />
      <Back to="/admin" label="Admin" />
      <div className="profile-head">
        <div className="avatar">{initials(p.full_name)}</div>
        <div><h1>{p.full_name}</h1><p className="muted" style={{ margin: 0 }}>{batchLabel(p)} · <Link to={`/players/${id}`}>View public page</Link></p></div>
      </div>

      <Section title="Details">
        <Heads fields={details} />
        <EditRow fields={details} row={p} run={run} onSave={(patch) => updateRow('players', ['id'], p, patch)} />
        <Heads fields={[{ k: 'other_sports', label: 'Other sports (comma separated)' }, { k: 'bio', label: 'Bio', w: 2 }]} />
        <EditRow fields={[{ k: 'other_sports_t', label: 'Other sports' }, { k: 'bio', label: 'Bio', type: 'textarea', w: 2 }]}
          row={{ ...p, other_sports_t: (p.other_sports || []).join(', ') }} run={run}
          onSave={({ other_sports_t, bio }) => updateRow('players', ['id'], p, { bio, other_sports: (other_sports_t || '').split(',').map((s) => s.trim()).filter(Boolean) })} />
      </Section>

      <Section title="Teams" count={mems.length} hint="Change a role, or remove him from a team. Add a team by choosing the age group and year.">
        {mems.length > 0 && <Heads lead="Team" fields={[{ k: 'role', label: 'Role' }, { k: 'position', label: 'Position' }]} />}
        {mems.map((m) => (
          <EditRow key={m.id} run={run} row={m}
            lead={<Link to={`/admin/team/${m.team_id}`}>{db.teamLabel(m.team)}</Link>}
            fields={[{ k: 'role', label: 'Role', type: 'select', options: ROLE_OPTS(m.team?.age_group) }, { k: 'position', label: 'Position' }]}
            onSave={(patch) => updateRow('team_memberships', ['id'], m, patch)} onDelete={(r) => deleteRow('team_memberships', ['id'], r)} />
        ))}
        <AddRow run={run} label="Add team" fields={[
          { k: 'age_group', label: 'Team', type: 'select', options: [['', 'Team…'], ...AGE_GROUPS.map((g) => [g, ageLabel(g)])], req: true },
          { k: 'season', label: 'Year', type: 'number', req: true },
          { k: 'role', label: 'Role', type: 'select', options: [['', 'Player'], 'Captain', 'Vice-captain', 'Secretary'] },
        ]} onAdd={async ({ age_group, season, role }) => {
          if (role === 'Secretary' && age_group !== '1st XI') throw new Error('Secretary is only for the 1st XI.')
          const t = await ensureTeam(age_group, season)
          await upsertRow('team_memberships', { player_id: id, team_id: t.id, role }, 'player_id,team_id')
        }} />
      </Section>

      <Section title="Achievements" count={ach.length} hint="Royal Colours use “Year no.” (1st Year, 2nd Year…). Leave Sport empty for Royal Crown and Senior Prefect.">
        <Heads fields={achFields} lead="Shown as" />
        {ach.map((a) => (
          <EditRow key={a.id} run={run} row={a} fields={achFields} lead={<span className="small">{honourLabel(a)}</span>}
            onSave={(patch) => updateRow('achievements', ['id'], a, patch)} onDelete={(r) => deleteRow('achievements', ['id'], r)} />
        ))}
        <AddRow run={run} label="Add achievement" lead="New" fields={achFields} onAdd={(row) => insertRow('achievements', { ...row, player_id: id })} />
      </Section>

      <Section title="Goals" count={goals.length} hint="Only matches of teams he played in are listed.">
        {goals.length > 0 && <Heads lead="Match" fields={[{ k: 'minute', label: 'Minute' }, { k: 'kind', label: 'Type' }]} />}
        {goals.map((g) => (
          <EditRow key={g.id} run={run} row={g} lead={g.m ? <Link to={`/admin/match/${g.match_id}`}>{matchName(db, g.m)}</Link> : '?'}
            fields={[{ k: 'minute', label: 'Minute', type: 'number' }, { k: 'kind', label: 'Type', type: 'select', options: KINDS }]}
            onSave={(patch) => updateRow('goals', ['id'], g, patch)} onDelete={(r) => deleteRow('goals', ['id'], r)} />
        ))}
        <AddRow run={run} label="Add goal" fields={[
          { k: 'match_id', label: 'Match', type: 'select', options: matchOpts, req: true, w: 3 },
          { k: 'minute', label: 'Minute', type: 'number' }, { k: 'kind', label: 'Type', type: 'select', options: KINDS },
        ]} onAdd={(row) => insertRow('goals', { ...row, player_id: id })} />
      </Section>

      <Section title="Contact (private)" hint="Only visible to signed-in members, and only when “Agreed to share” is ticked.">
        {contact === undefined ? <div className="sk" style={{ height: 50 }} /> : (() => {
          const cf = [{ k: 'phone', label: 'Phone' }, { k: 'email', label: 'Email', w: 1.5 }, { k: 'city', label: 'City' }, { k: 'consent', label: 'Agreed to share', type: 'check', w: 0.7 }]
          return (<>
            <Heads fields={cf} />
            {contact
              ? <EditRow run={run} row={contact} fields={cf} onSave={(patch) => updateRow('contacts', ['player_id'], contact, patch)} onDelete={(r) => deleteRow('contacts', ['player_id'], r)} />
              : <AddRow run={run} label="Save contact" fields={cf} onAdd={(row) => insertRow('contacts', { ...row, player_id: id })} />}
          </>)
        })()}
      </Section>

      <Section title="Merge or delete">
        <div className="row">
          <label className="inline">Same person as
            <select value={mergeWith} onChange={(e) => setMergeWith(e.target.value)} style={{ maxWidth: 320 }}>
              <option value="">Choose the duplicate record…</option>
              {db.players.filter((x) => x.id !== id).sort((a, b) => a.full_name.localeCompare(b.full_name)).map((x) => <option key={x.id} value={x.id}>{playerName(x)}</option>)}
            </select>
          </label>
          <button className="ghost" disabled={!mergeWith} onClick={() => run(async () => { await mergePlayers(db, id, mergeWith); setMergeWith('') }, 'Merged. The duplicate was removed and everything moved here.')}>Merge into this player</button>
        </div>
        <p className="small muted">Merging moves the other record's teams, achievements, goals and contact onto {p.full_name}, keeps this name, and deletes the other record.</p>
        <div className="row" style={{ marginTop: '1rem' }}>
          {confirmDel
            ? <><button className="danger" onClick={() => run(async () => { await deleteRow('players', ['id'], p); nav('/admin') }, 'Player deleted.')}>Yes, delete {p.full_name}</button><button className="ghost" onClick={() => setConfirmDel(false)}>Keep</button><span className="small error">This also deletes his team places, achievements and contact.</span></>
            : <button className="ghost" onClick={() => setConfirmDel(true)}><Bin /> Delete this player</button>}
        </div>
      </Section>
    </div>
  )
}

// ---------- Team ----------
export function TeamEditor({ db, id, reload }) {
  const nav = useNavigate()
  const { run, Toast } = useRunner(reload)
  const [confirmDel, setConfirmDel] = useState(false)
  const t = db.team[id]
  if (!t) return <p>Team not found. <Link to="/admin">Back to admin</Link></p>
  const coaches = [...new Set([...KNOWN_COACHES, ...db.teams.map((x) => x.coach).filter(Boolean)])].sort()
  const details = [
    { k: 'age_group', label: 'Team', type: 'select', options: AGE_GROUPS.map((g) => [g, ageLabel(g)]), req: true },
    { k: 'season', label: 'Year', type: 'number', req: true }, { k: 'coach', label: 'Coach', list: coaches, w: 1.5 }, { k: 'notes', label: 'Notes', w: 2 },
  ]
  const order = { Captain: 0, 'Vice-captain': 1, Secretary: 2 }
  const squad = (db.membershipsByTeam[id] || []).map((m) => ({ ...m, p: db.player[m.player_id] }))
    .sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9) || (a.p?.batch ?? 9999) - (b.p?.batch ?? 9999) || (a.p?.full_name || '').localeCompare(b.p?.full_name || ''))
  const comps = competitionsFor(t.age_group)
  const compNames = [...comps.tournaments, ...comps.trophies.map((x) => x.name)]
  const results = db.storedResultsByTeam[id] || []
  const fromMatches = (db.teamAchByTeam[id] || []).filter((a) => a.fromMatch)
  const matches = [...(db.matchesByTeam[id] || [])].sort((a, b) => (a.match_date || '').localeCompare(b.match_date || ''))
  const opponents = [...new Set([...db.opponents.map((o) => o.name), ...comps.trophies.map((x) => x.opponent)])].sort()
  const allNames = [...new Set(db.players.map((p) => p.full_name))].sort()

  return (
    <div className="editor">
      <Toast />
      <Back to="/admin" label="Admin" />
      <div className="team-title"><div className="eyebrow">Royal College</div><h1>{teamTitle(t)}</h1></div>
      <p className="muted"><Link to={`/teams/${id}`}>View public page</Link></p>

      <Section title="Details">
        <Heads fields={details} />
        <EditRow fields={details} row={t} run={run} onSave={(patch) => updateRow('teams', ['id'], t, patch)} />
      </Section>

      <Section title="Squad" count={squad.length} hint="Type a name to add a player. If he isn't in the archive yet, he's added as a new player.">
        {squad.length > 0 && <Heads lead="Player" fields={[{ k: 'role', label: 'Role' }, { k: 'position', label: 'Position' }]} />}
        {squad.map((m) => (
          <EditRow key={m.id} run={run} row={m} lead={<Link to={`/admin/player/${m.player_id}`}>{playerName(m.p)}</Link>}
            fields={[{ k: 'role', label: 'Role', type: 'select', options: ROLE_OPTS(t.age_group) }, { k: 'position', label: 'Position' }]}
            onSave={(patch) => updateRow('team_memberships', ['id'], m, patch)} onDelete={(r) => deleteRow('team_memberships', ['id'], r)} />
        ))}
        <AddRow run={run} label="Add player" fields={[
          { k: 'name', label: 'Player name', req: true, list: allNames, w: 2 }, { k: 'batch', label: 'Batch (if new)', type: 'number' },
          { k: 'role', label: 'Role', type: 'select', options: ROLE_OPTS(t.age_group) },
        ]} onAdd={async ({ name, batch, role }) => {
          const same = db.players.filter((p) => p.full_name.toLowerCase() === name.toLowerCase())
          const p = (batch ? same.find((x) => x.batch === batch) : same[0]) || await insertRow('players', { full_name: name, batch })
          await upsertRow('team_memberships', { player_id: p.id, team_id: id, role }, 'player_id,team_id')
        }} />
      </Section>

      <Section title="Achievements and finishes" count={results.length + fromMatches.length} hint="Every tournament and trophy this team played, with its matches. Trophy matches take their result from the score. For a tournament, choose how the team finished. Champions, Runners-Up, 2nd Runners-Up, and Winners or Drawn in trophy matches, show as achievements.">
        {(results.length + fromMatches.length) > 0 && <Heads lead="" fields={[{ k: 'title', label: 'Tournament or trophy', w: 2 }, { k: 'finish', label: 'Result' }, { k: 'source', label: 'Source' }]} />}
        {results.map((a) => (
          <div key={a.id} className="result-group">
            <EditRow run={run} row={a} lead={isAchievement(a) ? <span className="pill gold" style={{ margin: 0 }}>Achievement</span> : <span className="small muted">Result</span>}
              fields={[{ k: 'title', label: 'Tournament or trophy', req: true, list: compNames, w: 2 }, { k: 'finish', label: 'Result', type: 'select', options: [...new Set(['', ...(a.finish ? [a.finish] : []), ...resultsFor(a.title, t.age_group)])] }, { k: 'source', label: 'Source' }]}
              onSave={(patch) => updateRow('team_achievements', ['id'], a, patch)} onDelete={(r) => deleteRow('team_achievements', ['id'], r)} />
            <MatchList db={db} matches={db.matchesFor(a)} />
          </div>
        ))}
        {fromMatches.map((a) => (
          <div key={a.id} className="result-group">
            {a.trophy ? (
              <div className="ed-row" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) auto' }}>
                {isAchievement(a) ? <span className="pill gold" style={{ margin: 0, justifySelf: 'start' }}>Achievement</span> : <span className="small muted">Result</span>}
                <span>{a.title}</span><span>{a.finish || '—'}</span>
                <span className="small muted">From the match score</span><span />
              </div>
            ) : (
              <AddRow run={run} label="Save result" lead={<span className="small warn">Result not set</span>}
                fields={[{ k: 'title', label: 'Tournament or trophy', req: true, def: a.title, w: 2 }, { k: 'finish', label: 'Result', type: 'select', options: ['', ...resultsFor(a.title, t.age_group)], req: true }, { k: 'source', label: 'Source' }]}
                onAdd={(row) => insertRow('team_achievements', { ...row, team_id: id })} />
            )}
            <MatchList db={db} matches={db.matchesFor(a)} />
          </div>
        ))}
        <AddRow run={run} label="Add result" lead="New" fields={[{ k: 'title', label: 'Tournament or trophy', req: true, list: compNames, w: 2 }, { k: 'finish', label: 'Result', list: resultsFor('', t.age_group) }, { k: 'source', label: 'Source' }]}
          onAdd={(row) => insertRow('team_achievements', { ...row, team_id: id })} />
      </Section>

      <Section title="Season results" count={matches.length} hint="Every match this team played. Open a match to edit its goals and line-up.">
        {matches.length > 0 && <Heads lead="Match" fields={[{ k: 'score_for', label: 'Royal' }, { k: 'score_against', label: 'Opp.' }, { k: 'stage', label: 'Stage' }]} />}
        {matches.map((m) => (
          <EditRow key={m.id} run={run} row={m} lead={<Link to={`/admin/match/${m.id}`}>{m.match_date || 'Date unknown'} vs {db.opponent[m.opponent_id]?.name || '?'}{db.tournament[m.tournament_id] ? ` · ${db.tournament[m.tournament_id].name}` : ''}</Link>}
            fields={[{ k: 'score_for', label: 'Royal', type: 'number' }, { k: 'score_against', label: 'Opp.', type: 'number' }, { k: 'stage', label: 'Stage' }]}
            onSave={(patch) => updateRow('matches', ['id'], m, patch)} onDelete={(r) => deleteRow('matches', ['id'], r)} />
        ))}
        <AddRow run={run} label="Add match" fields={[
          { k: 'opponent', label: 'Opponent', req: true, list: opponents, w: 2 }, { k: 'match_date', label: 'Date', type: 'date' },
          { k: 'competition', label: 'Tournament or trophy', list: compNames, w: 2 },
          { k: 'score_for', label: 'Royal', type: 'number' }, { k: 'score_against', label: 'Opp.', type: 'number' },
          { k: 'venue', label: 'Venue', list: [...new Set([...KNOWN_VENUES, ...db.venues.map((v) => v.name)])].sort(), w: 1.5 },
        ]} onAdd={async ({ opponent, match_date, competition, score_for, score_against, venue }) => {
          const o = await findOrCreate('opponents', { name: opponent }, { name: opponent })
          const ven = venue ? await findOrCreate('venues', { name: venue }, { name: venue }) : null
          const c = competition ? await findOrCreate('tournaments', { name: competition, season: t.season }, { name: competition, season: t.season, level: comps.trophies.some((x) => x.name === competition) ? 'Trophy match' : 'Tournament' }) : null
          await insertRow('matches', { team_id: id, opponent_id: o.id, tournament_id: c?.id || null, venue_id: ven?.id || null, match_date, score_for, score_against })
        }} />
      </Section>

      <Section title="Delete team">
        {confirmDel
          ? <div className="row"><button className="danger" onClick={() => run(async () => { await deleteRow('teams', ['id'], t); nav('/admin') }, 'Team deleted.')}>Yes, delete {teamTitle(t)}</button><button className="ghost" onClick={() => setConfirmDel(false)}>Keep</button><span className="small error">This also deletes its squad list, results and matches. The players themselves stay.</span></div>
          : <button className="ghost" onClick={() => setConfirmDel(true)}><Bin /> Delete this team</button>}
      </Section>
    </div>
  )
}

// ---------- Match ----------
export function MatchEditor({ db, id, reload }) {
  const nav = useNavigate()
  const { run, Toast } = useRunner(reload)
  const [confirmDel, setConfirmDel] = useState(false)
  const m = db.match[id]
  if (!m) return <p>Match not found. <Link to="/admin">Back to admin</Link></p>
  const t = db.team[m.team_id]
  const row = { ...m, opponent: db.opponent[m.opponent_id]?.name || '', venue: db.venue[m.venue_id]?.name || '', competition: db.tournament[m.tournament_id]?.name || '' }
  const comps = competitionsFor(t?.age_group)
  const details = [
    { k: 'team_id', label: 'Royal team', type: 'select', options: [...db.teams].sort((a, b) => db.teamLabel(a).localeCompare(db.teamLabel(b))).map((x) => [x.id, db.teamLabel(x)]), req: true, w: 1.2 },
    { k: 'opponent', label: 'Opponent', req: true, list: db.opponents.map((o) => o.name).sort(), w: 1.8 },
    { k: 'match_date', label: 'Date', type: 'date' },
    { k: 'competition', label: 'Tournament or trophy', list: [...comps.tournaments, ...comps.trophies.map((x) => x.name)], w: 1.8 },
  ]
  const details2 = [
    { k: 'score_for', label: 'Royal goals', type: 'number' }, { k: 'score_against', label: 'Opp. goals', type: 'number' },
    { k: 'stage', label: 'Stage' }, { k: 'venue', label: 'Venue', list: [...new Set([...KNOWN_VENUES, ...db.venues.map((v) => v.name)])].sort(), w: 1.5 },
    { k: 'notes', label: 'Notes', type: 'textarea', w: 2 }, { k: 'source', label: 'Source', w: 1.3 },
  ]
  const saveDetails = async (patch) => {
    const out = { ...patch }
    if ('opponent' in patch) { out.opponent_id = patch.opponent ? (await findOrCreate('opponents', { name: patch.opponent }, { name: patch.opponent })).id : null; delete out.opponent }
    if ('venue' in patch) { out.venue_id = patch.venue ? (await findOrCreate('venues', { name: patch.venue }, { name: patch.venue })).id : null; delete out.venue }
    if ('competition' in patch) {
      const season = db.team[patch.team_id || m.team_id]?.season
      out.tournament_id = patch.competition ? (await findOrCreate('tournaments', { name: patch.competition, season }, { name: patch.competition, season })).id : null
      delete out.competition
    }
    await updateRow('matches', ['id'], m, out)
  }
  const goals = db.goalsByMatch[id] || []
  const lineup = db.match_players.filter((x) => x.match_id === id)
  const squadIds = new Set((db.membershipsByTeam[m.team_id] || []).map((x) => x.player_id))
  const playerOpts = [['', '—'], ...[...db.players].sort((a, b) => (squadIds.has(b.id) - squadIds.has(a.id)) || a.full_name.localeCompare(b.full_name)).map((p) => [p.id, `${squadIds.has(p.id) ? '' : '· '}${playerName(p)}`])]

  return (
    <div className="editor">
      <Toast />
      {t ? <Back to={`/admin/team/${t.id}`} label={teamTitle(t)} /> : <Back to="/admin" label="Admin" />}
      <h1>{db.teamLabel(t)} vs {row.opponent || '?'}</h1>
      <p className="muted"><Link to={`/matches/${id}`}>View public page</Link></p>

      <Section title="Match details" hint="Typing a new opponent, venue or competition adds it to the archive.">
        <Heads fields={details} />
        <EditRow fields={details} row={row} run={run} onSave={saveDetails} />
        <Heads fields={details2} />
        <EditRow fields={details2} row={row} run={run} onSave={saveDetails} />
      </Section>

      <Section title="Goals" count={goals.length} hint="Players in this team's squad are listed first.">
        {goals.length > 0 && <Heads fields={[{ k: 'player_id', label: 'Scorer', w: 2 }, { k: 'minute', label: 'Minute' }, { k: 'kind', label: 'Type' }]} />}
        {goals.map((g) => (
          <EditRow key={g.id} run={run} row={g} fields={[{ k: 'player_id', label: 'Scorer', type: 'select', options: playerOpts, w: 2 }, { k: 'minute', label: 'Minute', type: 'number' }, { k: 'kind', label: 'Type', type: 'select', options: KINDS }]}
            onSave={(patch) => updateRow('goals', ['id'], g, patch)} onDelete={(r) => deleteRow('goals', ['id'], r)} />
        ))}
        <AddRow run={run} label="Add goal" fields={[{ k: 'player_id', label: 'Scorer', type: 'select', options: playerOpts, w: 2 }, { k: 'minute', label: 'Minute', type: 'number' }, { k: 'kind', label: 'Type', type: 'select', options: KINDS }]}
          onAdd={(r) => insertRow('goals', { ...r, match_id: id })} />
      </Section>

      <Section title="Line-up" count={lineup.length}>
        {lineup.length > 0 && <Heads lead="Player" fields={[{ k: 'role', label: 'Role' }]} />}
        {lineup.map((x) => (
          <EditRow key={x.player_id} run={run} row={x} lead={<Link to={`/admin/player/${x.player_id}`}>{playerName(db.player[x.player_id])}</Link>}
            fields={[{ k: 'role', label: 'Role', list: ['Captain', 'Vice-captain', 'Goalkeeper', 'Substitute'] }]}
            onSave={(patch) => updateRow('match_players', ['match_id', 'player_id'], x, patch)} onDelete={(r) => deleteRow('match_players', ['match_id', 'player_id'], r)} />
        ))}
        <AddRow run={run} label="Add to line-up" fields={[{ k: 'player_id', label: 'Player', type: 'select', options: playerOpts, req: true, w: 2 }, { k: 'role', label: 'Role', list: ['Captain', 'Vice-captain', 'Goalkeeper', 'Substitute'] }]}
          onAdd={(r) => upsertRow('match_players', { ...r, match_id: id }, 'match_id,player_id')} />
      </Section>

      <Section title="Delete match">
        {confirmDel
          ? <div className="row"><button className="danger" onClick={() => run(async () => { await deleteRow('matches', ['id'], m); nav(t ? `/admin/team/${t.id}` : '/admin') }, 'Match deleted.')}>Yes, delete this match</button><button className="ghost" onClick={() => setConfirmDel(false)}>Keep</button><span className="small error">This also deletes its goals and line-up.</span></div>
          : <button className="ghost" onClick={() => setConfirmDel(true)}><Bin /> Delete this match</button>}
      </Section>
    </div>
  )
}

// ---------- Browse lists ----------
export function Browse({ db, kind }) {
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(60)
  const ql = q.trim().toLowerCase()
  let items
  if (kind === 'players') items = db.players.map((p) => ({
    id: p.id, to: `/admin/player/${p.id}`, title: p.full_name, sub: [batchLabel(p), `${(db.membershipsByPlayer[p.id] || []).length} teams`, `${(db.achievementsByPlayer[p.id] || []).length} achievements`].join(' · '),
    text: `${p.full_name} ${p.known_as || ''} ${p.batch || ''}`, sort: p.full_name,
  }))
  else if (kind === 'teams') items = db.teams.map((t) => ({
    id: t.id, to: `/admin/team/${t.id}`, title: teamTitle(t), sub: [`${(db.membershipsByTeam[t.id] || []).length} players`, `${(db.matchesByTeam[t.id] || []).length} matches`, t.coach].filter(Boolean).join(' · '),
    text: `${t.age_group} ${ageLabel(t.age_group)} ${t.season} ${t.coach || ''}`, sort: `${9999 - t.season} ${AGE_GROUPS.length - AGE_GROUPS.indexOf(t.age_group)}`,
  }))
  else items = db.matches.map((m) => ({
    id: m.id, to: `/admin/match/${m.id}`, title: `${db.teamLabel(db.team[m.team_id])} vs ${db.opponent[m.opponent_id]?.name || '?'}`,
    sub: [m.match_date || 'Date unknown', m.score_for != null ? `${m.score_for}–${m.score_against}` : null, db.tournament[m.tournament_id]?.name].filter(Boolean).join(' · '),
    text: `${db.teamLabel(db.team[m.team_id])} ${db.opponent[m.opponent_id]?.name || ''} ${m.match_date || ''} ${db.tournament[m.tournament_id]?.name || ''}`, sort: `${9999 - (db.team[m.team_id]?.season || 0)} ${m.match_date || ''}`,
  }))
  const list = items.filter((x) => !ql || x.text.toLowerCase().includes(ql)).sort((a, b) => a.sort.localeCompare(b.sort))
  return (
    <>
      <div className="row">
        <div className="search-wrap"><SearchIcon /><input autoFocus placeholder={`Search ${kind}`} value={q} onChange={(e) => { setQ(e.target.value); setLimit(60) }} /></div>
        <span className="small muted">{list.length} {kind}</span>
      </div>
      <div className="grid stagger" key={kind + q}>
        {list.slice(0, limit).map((x, i) => (
          <Link key={x.id} className="card" to={x.to} style={{ '--i': i }}>
            <div className="card-head">
              {kind === 'players' && <div className="avatar">{initials(x.title)}</div>}
              <div style={{ minWidth: 0 }}><b>{x.title}</b><div className="small muted">{x.sub}</div></div>
            </div>
          </Link>
        ))}
      </div>
      {list.length > limit && <button className="ghost add-btn" style={{ marginTop: '1rem' }} onClick={() => setLimit(limit + 60)}>Show more ({list.length - limit} left)</button>}
      {!list.length && <p className="muted">Nothing matches that search.</p>}
    </>
  )
}
