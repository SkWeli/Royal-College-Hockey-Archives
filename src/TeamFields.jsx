import { DidYouMean } from './components.jsx'
import { AGE_GROUPS, ageLabel, COUNTRIES, KNOWN_COACHES, competitionsFor, isAchievement, resultsFor, rolesFor, trophyFor } from './data/db.js'

// Shared by the public Submit form and the admin team form.
// value = { age_group, season, coach, newCoach, squad: [{ name, batch, role, country }],
//          results: [{ title, custom, finish, matches: [{ opponent, match_date, stage, score_for, score_against }] }] }
// custom: the competition was typed in rather than picked from the list.
export const emptyTeam = () => ({ age_group: '', season: '', coach: '', newCoach: '', squad: [], results: [] })
const emptyResult = () => ({ title: '', custom: false, finish: '', matches: [] })
const emptyGame = (opponent = '') => ({ opponent, match_date: '', stage: '', score_for: '', score_against: '' })
const NEW = '__new'
const thisYear = new Date().getFullYear()

const OTHER = '__other'
const listed = (g) => { const c = competitionsFor(g); return [...c.tournaments, ...c.trophies.map((t) => t.name)] }
const isListed = (g, name) => listed(g).includes(name)

// Tournament / trophy picker with an "Other" option, shared by the team and match forms.
export function CompetitionSelect({ ageGroup, value, custom, onChange, label = 'Tournament or trophy', allowFriendly = false }) {
  const c = competitionsFor(ageGroup)
  const isCustom = custom || (!!value && !isListed(ageGroup, value) && !(allowFriendly && value === 'Friendly'))
  return (
    <>
      <select className="grow" aria-label={label} value={isCustom ? OTHER : value} onChange={(e) => (e.target.value === OTHER ? onChange({ title: '', custom: true }) : onChange({ title: e.target.value, custom: false }))}>
        <option value="">{ageGroup ? 'Choose…' : 'Choose the team first…'}</option>
        {c.tournaments.length > 0 && <optgroup label="Tournaments">{c.tournaments.map((n) => <option key={n}>{n}</option>)}</optgroup>}
        {c.trophies.length > 0 && <optgroup label="Trophy matches">{c.trophies.map((t) => <option key={t.name} value={t.name}>{t.name} (vs {t.opponent})</option>)}</optgroup>}
        {allowFriendly && <option value="Friendly">Friendly</option>}
        <option value={OTHER}>Other (type it)</option>
      </select>
      {isCustom && <input className="grow reveal" placeholder="Name of the tournament or trophy" aria-label={`${label}, typed`} value={value} onChange={(e) => onChange({ title: e.target.value, custom: true })} />}
    </>
  )
}

export const coachOf = (t) => (t.coach === NEW ? t.newCoach.trim() : t.coach)

export function validateTeam(t) {
  const errs = []
  if (!t.age_group) errs.push('Team: choose the team')
  if (!t.season) errs.push('Year: enter the year')
  else if (!Number.isInteger(+t.season) || +t.season < 1835 || +t.season > thisYear) errs.push(`Year: ${t.season} isn't a valid year`)
  if (t.coach === NEW && t.newCoach.trim().length < 3) errs.push("Coach: type the new coach's name")
  t.squad.forEach((p, i) => {
    if (p.name.trim().length < 2) errs.push(`Player ${i + 1}: enter his name`)
    if (p.batch && (!Number.isInteger(+p.batch) || +p.batch < 1835 || +p.batch > thisYear + 12)) errs.push(`Player ${i + 1}: ${p.batch} isn't a valid batch year`)
  })
  const names = t.squad.map((p) => p.name.trim().toLowerCase()).filter(Boolean)
  if (new Set(names).size !== names.length) errs.push('Squad: the same player is listed twice')
  for (const r of rolesFor(t.age_group)) if (t.squad.filter((p) => p.role === r).length > 1) errs.push(`Squad: more than one ${r}`)
  t.results.forEach((r, i) => {
    const label = r.title || `Season result ${i + 1}`
    if (r.title.trim().length < 3) errs.push(`Season result ${i + 1}: choose or type the tournament or trophy`)
    if (!r.finish && r.title !== 'Friendly' && !r.matches.length) errs.push(`${label}: choose the result, or add its matches`)
    r.matches.forEach((m, j) => {
      const ml = `${label}, match ${j + 1}`
      if (m.opponent.trim().length < 3) errs.push(`${ml}: enter the opponent`)
      if ((m.score_for === '') !== (m.score_against === '')) errs.push(`${ml}: enter both scores, or leave both empty`)
      for (const k of ['score_for', 'score_against']) if (m[k] !== '' && (!Number.isInteger(+m[k]) || +m[k] < 0 || +m[k] > 50)) errs.push(`${ml}: ${m[k]} isn't a valid score`)
      if (m.match_date && t.season && +m.match_date.slice(0, 4) !== +t.season) errs.push(`${ml}: the date isn't in ${t.season}`)
    })
  })
  return errs
}

// Clean data, ready to save or send.
export const teamData = (t) => ({
  age_group: t.age_group, season: +t.season, coach: coachOf(t) || null,
  squad: t.squad.map((p) => ({ name: p.name.trim(), batch: p.batch ? +p.batch : null, role: p.role || null, country: p.country || 'Sri Lanka' })),
  results: t.results.map((r) => ({
    title: r.title.trim(), finish: r.finish || null,
    matches: r.matches.map((m) => ({ opponent: m.opponent.trim(), match_date: m.match_date || null, stage: m.stage.trim() || null,
      score_for: m.score_for === '' ? null : +m.score_for, score_against: m.score_against === '' ? null : +m.score_against })),
  })),
})
// Saved data back into the form (for admin review).
export const teamForm = (d) => ({
  age_group: d.age_group || '', season: d.season ?? '', coach: d.coach ? (KNOWN_COACHES.includes(d.coach) ? d.coach : NEW) : '', newCoach: d.coach && !KNOWN_COACHES.includes(d.coach) ? d.coach : '',
  squad: (d.squad || []).map((p) => ({ name: p.name || '', batch: p.batch ?? '', role: p.role || '', country: p.country || 'Sri Lanka' })),
  // older submissions used "achievements" without matches
  results: (d.results || d.achievements || []).map((r) => ({
    title: r.title || '', finish: r.finish || '', custom: !!r.title && r.title !== 'Friendly' && !isListed(d.age_group, r.title),
    matches: (r.matches || []).map((m) => ({ opponent: m.opponent || '', match_date: m.match_date || '', stage: m.stage || '', score_for: m.score_for ?? '', score_against: m.score_against ?? '' })),
  })),
})

const Remove = ({ onClick, label }) => (
  <button type="button" className="ghost icon-btn" aria-label={label} onClick={onClick}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
  </button>
)
const Plus = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>

export default function TeamFields({ value: t, onChange, db }) {
  const set = (patch) => onChange({ ...t, ...patch })
  const coaches = [...new Set([...KNOWN_COACHES, ...(db?.teams || []).map((x) => x.coach).filter(Boolean)])].sort()
  const setRow = (key, i, patch) => set({ [key]: t[key].map((r, j) => (j === i ? { ...r, ...patch } : r)) })
  const roles = rolesFor(t.age_group)
  const known = (db?.players || []).map((p) => p.full_name)

  return (
    <>
      <div className="two">
        <label>Team *
          <select value={t.age_group} onChange={(e) => set({ age_group: e.target.value, squad: t.squad.map((p) => (rolesFor(e.target.value).includes(p.role) ? p : { ...p, role: '' })) })}>
            <option value="">Choose a team…</option>
            {AGE_GROUPS.map((g) => <option key={g} value={g}>{g === '1st XI' ? '1st XI' : `${ageLabel(g)} team`}</option>)}
          </select>
        </label>
        <label>Year *<input type="number" inputMode="numeric" placeholder="2016" value={t.season} onChange={(e) => set({ season: e.target.value })} /></label>
      </div>
      <label>Coach
        <select value={t.coach} onChange={(e) => set({ coach: e.target.value })}>
          <option value="">Not sure</option>
          {coaches.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value={NEW}>+ Add a coach not listed</option>
        </select>
      </label>
      {t.coach === NEW && <label className="reveal">New coach's name *<input autoFocus placeholder="Mr. …" value={t.newCoach} onChange={(e) => set({ newCoach: e.target.value })} /></label>}

      <fieldset className="hset">
        <legend>Squad</legend>
        <p className="small muted">Add each player in the team. New names are added to the archive as new players when the admin approves.</p>
        <datalist id="known-players">{known.map((n) => <option key={n} value={n} />)}</datalist>
        <div className="rowlist">
          {t.squad.map((p, i) => (
            <div key={i} className="rowcard">
              <span className="rownum">{i + 1}</span>
              <div className="rowcard-body">
                <div className="rowcard-line">
                  <input className="grow" list="known-players" placeholder="Player's full name" aria-label={`Player ${i + 1} name`} value={p.name} onChange={(e) => setRow('squad', i, { name: e.target.value })} />
                  <input className="year" type="number" inputMode="numeric" placeholder="Batch" aria-label={`Player ${i + 1} batch (year he left Royal)`} value={p.batch} onChange={(e) => setRow('squad', i, { batch: e.target.value })} />
                </div>
                <DidYouMean name={p.name} players={db?.players} onPick={(x) => setRow('squad', i, { name: x.full_name, batch: x.batch ?? p.batch })} />
                <div className="rowcard-line">
                  <label className="inline">Lives in
                    <select value={p.country} onChange={(e) => setRow('squad', i, { country: e.target.value })}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select>
                  </label>
                  <div className="chips">
                    {roles.map((r) => <button type="button" key={r} className={`chip ${p.role === r ? 'on' : ''}`} aria-pressed={p.role === r} onClick={() => setRow('squad', i, { role: p.role === r ? '' : r })}>{r}</button>)}
                  </div>
                </div>
              </div>
              <Remove label={`Remove player ${i + 1}`} onClick={() => set({ squad: t.squad.filter((_, j) => j !== i) })} />
            </div>
          ))}
        </div>
        <button type="button" className="ghost add-btn" onClick={() => set({ squad: [...t.squad, { name: '', batch: '', role: '', country: 'Sri Lanka' }] })}><Plus /> Add player</button>
      </fieldset>

      <fieldset className="hset">
        <legend>Season results</legend>
        <p className="small muted">Add each tournament or trophy match the team played, how they finished, and any matches you remember. Champions, Runners-Up, 2nd Runners-Up, and Winners or Drawn in a trophy match, show as the team's achievements.</p>
        <div className="rowlist">
          {t.results.map((r, i) => {
            const setR = (patch) => setRow('results', i, patch)
            const setM = (j, patch) => setR({ matches: r.matches.map((m, k) => (k === j ? { ...m, ...patch } : m)) })
            const trophy = trophyFor(r.title)
            const results = r.title === 'Friendly' ? [] : resultsFor(r.title, t.age_group)
            return (
              <div key={i} className="rowcard result-card">
                <span className="rownum">{i + 1}</span>
                <div className="rowcard-body">
                  <div className="rowcard-line">
                    <CompetitionSelect ageGroup={t.age_group} value={r.title} custom={r.custom} label={`Season result ${i + 1}`} allowFriendly
                      onChange={({ title, custom }) => setR({ title, custom, finish: (title === 'Friendly' ? [] : resultsFor(title, t.age_group)).includes(r.finish) ? r.finish : '' })} />
                    {results.length > 0 && (
                      <select className="mid" aria-label={`Season result ${i + 1}, result`} value={r.finish} onChange={(e) => setR({ finish: e.target.value })}>
                        <option value="">Result…</option>
                        {results.map((x) => <option key={x}>{x}</option>)}
                      </select>
                    )}
                    {isAchievement(r) && <span className="pill gold">Achievement</span>}
                  </div>
                  {r.matches.length > 0 && (
                    <div className="games">
                      <div className="game-head"><span>Opponent</span><span>Date</span><span>Stage</span><span>Royal</span><span>Opp.</span><span /></div>
                      {r.matches.map((m, j) => (
                        <div key={j} className="game">
                          <input list="known-opponents" placeholder="Opponent" aria-label={`Match ${j + 1} opponent`} value={m.opponent} onChange={(e) => setM(j, { opponent: e.target.value })} />
                          <input type="date" aria-label={`Match ${j + 1} date`} value={m.match_date} onChange={(e) => setM(j, { match_date: e.target.value })} />
                          <input placeholder="e.g. Final" aria-label={`Match ${j + 1} stage`} value={m.stage} onChange={(e) => setM(j, { stage: e.target.value })} />
                          <input type="number" inputMode="numeric" min="0" placeholder="–" aria-label={`Match ${j + 1} Royal goals`} value={m.score_for} onChange={(e) => setM(j, { score_for: e.target.value })} />
                          <input type="number" inputMode="numeric" min="0" placeholder="–" aria-label={`Match ${j + 1} opponent goals`} value={m.score_against} onChange={(e) => setM(j, { score_against: e.target.value })} />
                          <Remove label={`Remove match ${j + 1}`} onClick={() => setR({ matches: r.matches.filter((_, k) => k !== j) })} />
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" className="ghost small-add" onClick={() => setR({ matches: [...r.matches, emptyGame(trophy && !r.matches.length ? trophy.opponent : '')] })}><Plus /> Add match</button>
                </div>
                <Remove label={`Remove season result ${i + 1}`} onClick={() => set({ results: t.results.filter((_, j) => j !== i) })} />
              </div>
            )
          })}
        </div>
        <datalist id="known-opponents">{[...new Set([...(db?.opponents || []).map((o) => o.name), ...AGE_GROUPS.flatMap((g) => competitionsFor(g).trophies.map((x) => x.opponent))])].sort().map((o) => <option key={o} value={o} />)}</datalist>
        <button type="button" className="ghost add-btn" onClick={() => set({ results: [...t.results, emptyResult()] })}><Plus /> Add tournament or trophy</button>
      </fieldset>
    </>
  )
}
