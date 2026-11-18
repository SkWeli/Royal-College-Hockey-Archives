import { useState } from 'react'
import { useData } from '../App.jsx'
import { historySummary, sendSubmission, teamSummary } from '../data/db.js'
import TeamFields, { emptyTeam, teamData, validateTeam } from '../TeamFields.jsx'
import HistoryFields, { PlayerBasics, emptyHistory, emptyPlayer, playerRow, validateHistory, validatePlayer } from '../HistoryFields.jsx'

// Player and Team have structured forms; the rest are plain text fields the admin reads.
const KINDS = {
  Player: null, // structured forms below
  Team: null,
  Match: [['Royal team (e.g. 1st XI 2016)', true], ['Opponent', true], ['Date'], ['Score (Royal – opponent)', true], ['Competition / stage'], ['Venue'], ['Royal goalscorers', false, true], ['Notes', false, true]],
  Achievement: [['Player or team', true], ['Achievement (e.g. Royal Colours, Royal Crown, Best player)', true], ['Sport'], ['Year']],
  Correction: [['Which page or entry?', true], ['What should change?', true, true]],
  Other: [['Your message', true, true]],
}

export default function Submit() {
  const { db } = useData()
  const [team, setTeam] = useState(emptyTeam)
  const [kind, setKind] = useState('Player')
  const [vals, setVals] = useState({})
  const [player, setPlayer] = useState(emptyPlayer)
  const [history, setHistory] = useState(emptyHistory)
  const [who, setWho] = useState({ submitter_name: '', submitter_batch: '', submitter_contact: '', botcheck: '' })
  const [state, setState] = useState({})
  const fields = KINDS[kind]
  const set = (k, v) => { setVals((s) => ({ ...s, [k]: v })); setState({}) }
  const setW = (k, v) => { setWho((s) => ({ ...s, [k]: v })); setState({}) }

  const submit = async (e) => {
    e.preventDefault()
    const errs = fields ? fields.filter(([l, req]) => req && !vals[l]?.trim()).map(([l]) => `${l}: required`)
      : kind === 'Team' ? validateTeam(team) : [...validatePlayer(player), ...validateHistory(history, player)]
    if (who.submitter_name.trim().length < 2) errs.push('Your name: required')
    if (errs.length) { setState({ errs }); setTimeout(() => document.querySelector('.errors')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); return }
    setState({ busy: true })
    try {
      const details = fields ? Object.fromEntries(fields.map(([l]) => [l, vals[l]?.trim() || '']))
        : kind === 'Team' ? { ...teamSummary(teamData(team)), _data: { team: teamData(team) } } : {
        'Full name': player.full_name.trim(), 'Known as': player.known_as.trim(),
        'At Royal': player.joined_year || player.batch ? `${player.joined_year || '?'}–${player.batch || '?'}` : '',
        'Other sports': player.other_sports.trim(), ...historySummary(history), 'Anything else': player.bio.trim(),
        _data: { player: playerRow(player), history },
      }
      await sendSubmission({ kind, details, ...who })
      setVals({}); setPlayer(emptyPlayer()); setHistory(emptyHistory()); setTeam(emptyTeam())
      setState({ ok: true })
    } catch (err) { setState({ err: err.message }) }
  }

  if (state.ok) return (
    <div className="form-card" style={{ textAlign: 'center', margin: '2rem auto' }}>
      <svg className="check" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="36" /><path d="M25 41l10 10 20-22" /></svg>
      <h1>Thank you</h1>
      <p>Your submission has been sent to the archive admin. It will appear on the site once it has been checked.</p>
      <button className="gold" onClick={() => setState({})}>Send another</button>
    </div>
  )

  return (
    <>
      <h1>Submit information</h1>
      <p className="lead">Know a player, a team, a match result or an achievement that's missing, or spotted a mistake? Send it here. The admin checks every submission before adding it to the archive.</p>
      <div className="tabs">{Object.keys(KINDS).map((k) => <button key={k} type="button" className={k === kind ? 'on' : 'ghost'} onClick={() => { setKind(k); setVals({}); setState({}) }}>{k}</button>)}</div>
      <div className="form-card">
      <form className="stack" onSubmit={submit}>
        {kind === 'Team' && <TeamFields db={db} value={team} onChange={(v) => { setTeam(v); setState({}) }} />}
        {kind === 'Player' && <><PlayerBasics value={player} onChange={(v) => { setPlayer(v); setState({}) }} /><HistoryFields value={history} onChange={(v) => { setHistory(v); setState({}) }} /></>}
        {fields?.map(([label, req, long]) => (
          <label key={kind + label}>{label}{req ? ' *' : ''}
            {long ? <textarea rows="3" value={vals[label] || ''} onChange={(e) => set(label, e.target.value)} />
              : <input value={vals[label] || ''} onChange={(e) => set(label, e.target.value)} />}
          </label>
        ))}
        <h2 style={{ margin: '.6rem 0 0' }}>About you</h2>
        <label>Your name *<input value={who.submitter_name} onChange={(e) => setW('submitter_name', e.target.value)} /></label>
        <label>Your batch (year you left Royal)<input type="number" inputMode="numeric" value={who.submitter_batch} onChange={(e) => setW('submitter_batch', e.target.value)} placeholder="2021" /></label>
        <label>Phone or email, so the admin can check details with you
          <input value={who.submitter_contact} onChange={(e) => setW('submitter_contact', e.target.value)} placeholder="+94 77 123 4567" />
        </label>
        <input type="text" name="botcheck" value={who.botcheck} onChange={(e) => setW('botcheck', e.target.value)} tabIndex="-1" autoComplete="off" style={{ display: 'none' }} aria-hidden="true" />
        <p className="small muted">Your contact details are only seen by the admin and are never shown on the site.</p>
        <button className="gold" disabled={state.busy}>{state.busy ? 'Sending…' : 'Submit'}</button>
        {state.errs && <div className="errors" role="alert">Please fix these:<ul>{state.errs.map((e) => <li key={e}>{e}</li>)}</ul></div>}
        {state.err && <p className="error small">{state.err}</p>}
      </form>
      </div>
    </>
  )
}
