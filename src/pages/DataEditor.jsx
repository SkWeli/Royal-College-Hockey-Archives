import { useEffect, useMemo, useState } from 'react'
import { AGE_GROUPS, COUNTRIES, batchLabel, deleteRow, demoMode, fetchTable, honourLabel, updateRow } from '../data/db.js'
import { SearchIcon } from '../components.jsx'

// Column types: text, number, textarea, list (comma separated → array), bool, date, [options], { ref: 'players' | ... }
const ROLE = ['', 'Captain', 'Vice-captain', 'Secretary']
const TABLES = {
  players: { label: 'Players', pk: ['id'], cols: [['full_name', 'Full name', 'text', true], ['known_as', 'Known as'], ['joined_year', 'Joined', 'number'], ['batch', 'Batch (left)', 'number'], ['residence_country', 'Lives in', ['', ...COUNTRIES]], ['other_sports', 'Other sports', 'list'], ['bio', 'Bio', 'textarea']],
    warn: 'Deleting a player also deletes his team places, achievements and contact details.' },
  teams: { label: 'Teams', pk: ['id'], cols: [['age_group', 'Team', AGE_GROUPS, true], ['season', 'Year', 'number', true], ['coach', 'Coach'], ['notes', 'Notes', 'textarea']],
    warn: 'Deleting a team also deletes its squad list, achievements and matches.' },
  team_memberships: { label: 'Squad places', pk: ['id'], cols: [['player_id', 'Player', { ref: 'players' }, true], ['team_id', 'Team', { ref: 'teams' }, true], ['role', 'Role', ROLE], ['position', 'Position']] },
  achievements: { label: 'Player achievements', pk: ['id'], cols: [['player_id', 'Player', { ref: 'players' }, true], ['title', 'Achievement', 'text', true], ['level', 'Level (e.g. 1st Year)'], ['role', 'Role (e.g. Captain (Reds))'], ['sport', 'Sport (empty for Royal Crown, Senior Prefect)'], ['season', 'Year', 'number'], ['source', 'Source']] },
  team_achievements: { label: 'Team achievements', pk: ['id'], cols: [['team_id', 'Team', { ref: 'teams' }, true], ['title', 'Achievement', 'text', true], ['finish', 'Result'], ['source', 'Source']] },
  matches: { label: 'Matches', pk: ['id'], cols: [['team_id', 'Royal team', { ref: 'teams' }, true], ['opponent_id', 'Opponent', { ref: 'opponents' }], ['match_date', 'Date', 'date'], ['score_for', 'Royal', 'number'], ['score_against', 'Opp.', 'number'], ['venue_id', 'Venue', { ref: 'venues' }], ['tournament_id', 'Competition', { ref: 'tournaments' }], ['stage', 'Stage'], ['notes', 'Notes', 'textarea'], ['source', 'Source']],
    warn: 'Deleting a match also deletes its goals and line-up.' },
  goals: { label: 'Goals', pk: ['id'], cols: [['match_id', 'Match', { ref: 'matches' }, true], ['player_id', 'Scorer', { ref: 'players' }], ['minute', 'Minute', 'number'], ['kind', 'Type', ['', 'Field goal', 'Penalty corner', 'Penalty stroke']]] },
  opponents: { label: 'Opponents', pk: ['id'], cols: [['name', 'Name', 'text', true]], warn: 'Matches against this opponent will lose their opponent.' },
  venues: { label: 'Venues', pk: ['id'], cols: [['name', 'Name', 'text', true], ['city', 'City'], ['surface', 'Surface', ['', 'Grass', 'Astro']]] },
  tournaments: { label: 'Competitions', pk: ['id'], cols: [['name', 'Name', 'text', true], ['level', 'Type', ['', 'Tournament', 'Trophy match', 'Friendly', 'League', 'All-Island', 'Big match']], ['season', 'Year', 'number']] },
  milestones: { label: 'Club milestones', pk: ['id'], cols: [['season', 'Year', 'number', true], ['event_date', 'Date', 'date'], ['title', 'What happened', 'text', true], ['details', 'Details', 'textarea'], ['source', 'Source']] },
  contacts: { label: 'Contacts (private)', pk: ['player_id'], cols: [['player_id', 'Player', { ref: 'players' }, true, true], ['phone', 'Phone'], ['email', 'Email'], ['city', 'City'], ['consent', 'Agreed to share', 'bool']] },
}

function useLabels(db) {
  return useMemo(() => ({
    players: (id) => { const p = db.player[id]; return p ? `${p.full_name}${p.batch ? ` (${batchLabel(p)})` : ''}` : '' },
    teams: (id) => db.teamLabel(db.team[id]),
    opponents: (id) => db.opponent[id]?.name || '',
    venues: (id) => db.venue[id]?.name || '',
    tournaments: (id) => { const t = db.tournament[id]; return t ? `${t.name}${t.season ? ` ${t.season}` : ''}` : '' },
    matches: (id) => { const m = db.match[id]; return m ? `${m.match_date || '?'} ${db.teamLabel(db.team[m.team_id])} vs ${db.opponent[m.opponent_id]?.name || '?'}` : '' },
  }), [db])
}

const show = (labels, [k, , type], row) => {
  const v = row[k]
  if (v == null || v === '') return <span className="muted">—</span>
  if (type?.ref) return labels[type.ref](v) || <span className="muted">missing</span>
  if (type === 'bool') return v ? 'Yes' : 'No'
  if (type === 'list') return v.join(', ')
  return String(v)
}

function Field({ col: [k, label, type = 'text', req, locked], value, set, db, labels }) {
  const common = { 'aria-label': label, disabled: locked }
  let input
  if (type?.ref) {
    const ids = db[type.ref].map((r) => r.id).sort((a, b) => labels[type.ref](a).localeCompare(labels[type.ref](b)))
    input = <select {...common} value={value ?? ''} onChange={(e) => set(e.target.value || null)}><option value="">—</option>{ids.map((id) => <option key={id} value={id}>{labels[type.ref](id)}</option>)}</select>
  } else if (Array.isArray(type)) input = <select {...common} value={value ?? ''} onChange={(e) => set(e.target.value || null)}>{type.map((o) => <option key={o} value={o}>{o || '—'}</option>)}</select>
  else if (type === 'textarea') input = <textarea {...common} rows="3" value={value ?? ''} onChange={(e) => set(e.target.value)} />
  else if (type === 'bool') input = <input {...common} type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} style={{ justifySelf: 'start', width: 20, height: 20 }} />
  else if (type === 'list') input = <input {...common} value={Array.isArray(value) ? value.join(', ') : value ?? ''} onChange={(e) => set(e.target.value)} />
  else input = <input {...common} type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'} value={value ?? ''} onChange={(e) => set(e.target.value)} />
  return <label>{label}{req ? ' *' : ''}{input}</label>
}

function EditRow({ spec, row, db, labels, onSaved, onCancel }) {
  const [vals, setVals] = useState(row)
  const [st, setSt] = useState({})
  const save = async (e) => {
    e.preventDefault()
    const patch = {}
    for (const [k, label, type, req, locked] of spec.cols) {
      if (locked) continue
      let v = vals[k]
      if (type === 'number') v = v === '' || v == null ? null : Number(v)
      else if (type === 'list') v = Array.isArray(v) ? v : String(v || '').split(',').map((s) => s.trim()).filter(Boolean)
      else if (typeof v === 'string') v = v.trim() === '' ? null : v.trim()
      if (req && (v == null || v === '')) return setSt({ err: `${label} is required.` })
      if (type === 'number' && v != null && !Number.isFinite(v)) return setSt({ err: `${label} must be a number.` })
      if (JSON.stringify(v) !== JSON.stringify(row[k])) patch[k] = v
    }
    if (!Object.keys(patch).length) return onCancel()
    setSt({ busy: true })
    try { onSaved(await updateRow(spec.table, spec.pk, row, patch)) } catch (err) { setSt({ err: err.message }) }
  }
  return (
    <form className="stack edit-panel" onSubmit={save}>
      <div className="two">{spec.cols.map((c) => <Field key={c[0]} col={c} db={db} labels={labels} value={vals[c[0]]} set={(v) => { setVals((s) => ({ ...s, [c[0]]: v })); setSt({}) }} />)}</div>
      <div className="row" style={{ margin: 0 }}>
        <button className="gold" disabled={st.busy}>{st.busy ? 'Saving…' : 'Save changes'}</button>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        {st.err && <span className="error small">{st.err}</span>}
      </div>
    </form>
  )
}

export default function DataEditor({ db, onChanged }) {
  const [table, setTable] = useState('players')
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(50)
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [toast, setToast] = useState('')
  const labels = useLabels(db)
  const spec = { ...TABLES[table], table }
  const key = (r) => spec.pk.map((k) => r[k]).join('|')

  useEffect(() => {
    setRows(null); setErr(''); setEditing(null); setConfirm(null); setLimit(50)
    if (demoMode) { setRows(table === 'contacts' ? [] : db[table] || []); return }
    fetchTable(table).then(setRows).catch((e) => setErr(e.message))
  }, [table, db])

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }
  const text = (r) => spec.cols.map((c) => { const v = show(labels, c, r); return typeof v === 'string' ? v : '' }).join(' ').toLowerCase()
  const list = (rows || []).filter((r) => !q || text(r).includes(q.toLowerCase()))
  const shown = spec.cols.filter(([, , type]) => type !== 'textarea').slice(0, 5)

  const remove = async (r) => {
    try { await deleteRow(table, spec.pk, r); setRows((rs) => rs.filter((x) => key(x) !== key(r))); setConfirm(null); flash('Deleted.'); onChanged() } catch (e) { setErr(e.message) }
  }

  return (
    <>
      <div className="row">
        <label className="inline">Table
          <select value={table} onChange={(e) => { setTable(e.target.value); setQ('') }}>{Object.entries(TABLES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select>
        </label>
        <div className="search-wrap"><SearchIcon /><input placeholder="Search this table" value={q} onChange={(e) => { setQ(e.target.value); setLimit(50) }} /></div>
        {rows && <span className="small muted">{list.length} of {rows.length} rows</span>}
      </div>
      {toast && <p className="ok small" role="status">{toast}</p>}
      {err && <p className="error">{err}</p>}
      {!rows && !err && <div className="sk" style={{ height: 200, borderRadius: 14 }} />}
      {rows && !list.length && <p className="muted">No rows{q ? ' match that search' : ' yet'}.</p>}
      {rows && list.length > 0 && (
        <div className="data-list" style={{ '--n': shown.length }}>
          <div className="data-head">{shown.map(([k, l]) => <span key={k}>{l}</span>)}<span /></div>
          {list.slice(0, limit).map((r) => {
            const id = key(r)
            return (
              <div key={id} className={`data-row ${editing === id ? 'open' : ''}`}>
                <div className="data-cells">
                  {shown.map((c) => <span key={c[0]} data-l={c[1]}>{table === 'achievements' && c[0] === 'title' ? honourLabel(r) : show(labels, c, r)}</span>)}
                  <span className="data-actions">
                    {confirm === id ? (<>
                      <button className="danger" onClick={() => remove(r)}>Delete</button>
                      <button className="ghost" onClick={() => setConfirm(null)}>Keep</button>
                    </>) : (<>
                      <button className="ghost" onClick={() => { setEditing(editing === id ? null : id); setConfirm(null) }}>{editing === id ? 'Close' : 'Edit'}</button>
                      <button className="ghost icon-btn" aria-label="Delete" onClick={() => { setConfirm(id); setEditing(null) }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                      </button>
                    </>)}
                  </span>
                </div>
                {confirm === id && <p className="small error" style={{ margin: '.2rem 0 0' }}>Delete this row? This can't be undone.{spec.warn ? ` ${spec.warn}` : ''}</p>}
                {editing === id && <EditRow spec={spec} row={r} db={db} labels={labels} onCancel={() => setEditing(null)}
                  onSaved={(nr) => { setRows((rs) => rs.map((x) => (key(x) === id ? nr : x))); setEditing(null); flash('Saved.'); onChanged() }} />}
              </div>
            )
          })}
          {list.length > limit && <button className="ghost add-btn" onClick={() => setLimit(limit + 50)}>Show more ({list.length - limit} left)</button>}
        </div>
      )}
    </>
  )
}
