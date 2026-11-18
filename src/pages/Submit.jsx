import { useState } from 'react'
import { sendSubmission } from '../data/db.js'

// Plain text fields per kind: easy for anyone to fill. The admin turns them into archive entries.
const KINDS = {
  Player: [['Full name', true], ['Known as'], ['Batch / years at Royal'], ['Teams played in (e.g. U15 2014, 1st XI 2016–17)', false, true], ['Captaincy'], ['Colours and other honours', false, true], ['Other sports'], ['Anything else', false, true]],
  Team: [['Age group (U9–1st XI)', true], ['Season (year)', true], ['Captain'], ['Coach'], ['Squad (names)', false, true], ['Honours won (e.g. All-Island 3rd place)', false, true]],
  Match: [['Royal team (e.g. 1st XI 2016)', true], ['Opponent', true], ['Date'], ['Score (Royal – opponent)', true], ['Competition / stage'], ['Venue'], ['Royal goalscorers', false, true], ['Notes', false, true]],
  Honour: [['Player or team', true], ['Honour (e.g. Colours, Best player)', true], ['Sport'], ['Level (e.g. 1st year, 2nd year, National)'], ['Season (year)']],
  Correction: [['Which page or entry?', true], ['What should change?', true, true]],
  Other: [['Your message', true, true]],
}

export default function Submit() {
  const [kind, setKind] = useState('Player')
  const [vals, setVals] = useState({})
  const [who, setWho] = useState({ submitter_name: '', submitter_batch: '', submitter_contact: '', source: '', botcheck: '' })
  const [state, setState] = useState({})
  const fields = KINDS[kind]
  const set = (k, v) => { setVals((s) => ({ ...s, [k]: v })); setState({}) }
  const setW = (k, v) => { setWho((s) => ({ ...s, [k]: v })); setState({}) }

  const submit = async (e) => {
    e.preventDefault()
    const missing = fields.filter(([l, req]) => req && !vals[l]?.trim()).map(([l]) => l)
    if (who.submitter_name.trim().length < 2) missing.push('Your name')
    if (missing.length) return setState({ err: `Fill in: ${missing.join(', ')}` })
    setState({ busy: true })
    try {
      const details = Object.fromEntries(fields.map(([l]) => [l, vals[l]?.trim() || '']))
      if (who.source.trim()) details['Source'] = who.source.trim()
      await sendSubmission({ kind, details, ...who })
      setVals({}); setWho((w) => ({ ...w, source: '' }))
      setState({ ok: true })
    } catch (err) { setState({ err: err.message }) }
  }

  if (state.ok) return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h1>Thank you</h1>
      <p>Your submission has been sent to the archive admin. It will appear on the site once it has been checked.</p>
      <button onClick={() => setState({})}>Send another</button>
    </div>
  )

  return (
    <>
      <h1>Submit information</h1>
      <p className="muted" style={{ maxWidth: 640 }}>Know a player, a team, a match result or an honour that's missing, or spotted a mistake? Send it here. The admin checks every submission before adding it to the archive.</p>
      <div className="tabs">{Object.keys(KINDS).map((k) => <button key={k} type="button" className={k === kind ? 'on' : 'ghost'} onClick={() => { setKind(k); setVals({}); setState({}) }}>{k}</button>)}</div>
      <form className="stack" onSubmit={submit}>
        {fields.map(([label, req, long]) => (
          <label key={kind + label}>{label}{req ? ' *' : ''}
            {long ? <textarea rows="3" value={vals[label] || ''} onChange={(e) => set(label, e.target.value)} />
              : <input value={vals[label] || ''} onChange={(e) => set(label, e.target.value)} />}
          </label>
        ))}
        <label>How do you know this? (e.g. I was in the team, a newspaper cutting, a scorebook)
          <input value={who.source} onChange={(e) => setW('source', e.target.value)} />
        </label>
        <h2 style={{ margin: '.6rem 0 0' }}>About you</h2>
        <label>Your name *<input value={who.submitter_name} onChange={(e) => setW('submitter_name', e.target.value)} /></label>
        <label>Your batch<input value={who.submitter_batch} onChange={(e) => setW('submitter_batch', e.target.value)} placeholder="88/89" /></label>
        <label>Phone or email, so the admin can check details with you
          <input value={who.submitter_contact} onChange={(e) => setW('submitter_contact', e.target.value)} placeholder="+94 77 123 4567" />
        </label>
        <input type="text" name="botcheck" value={who.botcheck} onChange={(e) => setW('botcheck', e.target.value)} tabIndex="-1" autoComplete="off" style={{ display: 'none' }} aria-hidden="true" />
        <p className="small muted">Your contact details are only seen by the admin and are never shown on the site.</p>
        <button disabled={state.busy}>{state.busy ? 'Sending…' : 'Submit'}</button>
        {state.err && <p className="error small">{state.err}</p>}
      </form>
    </>
  )
}
