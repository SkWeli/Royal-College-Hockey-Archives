import { AGE_GROUPS, ageLabel, COUNTRIES, KNOWN_COACHES, competitionsFor, resultsFor, rolesFor } from './data/db.js'

// Shared by the public Submit form and the admin team form.
// value = { age_group, season, coach, newCoach, squad: [{ name, batch, role, country }], achievements: [{ title, finish, custom }] }
// custom: the competition was typed in rather than picked from the list.
export const emptyTeam = () => ({ age_group: '', season: '', coach: '', newCoach: '', squad: [], achievements: [] })
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
  t.achievements.forEach((a, i) => {
    if (a.title.trim().length < 3) errs.push(`Achievement ${i + 1}: choose or type the tournament or trophy`)
    if (!a.finish) errs.push(`Achievement ${i + 1}: choose the result`)
  })
  return errs
}

// Clean data, ready to save or send.
export const teamData = (t) => ({
  age_group: t.age_group, season: +t.season, coach: coachOf(t) || null,
  squad: t.squad.map((p) => ({ name: p.name.trim(), batch: p.batch ? +p.batch : null, role: p.role || null, country: p.country || 'Sri Lanka' })),
  achievements: t.achievements.map((a) => ({ title: a.title.trim(), finish: a.finish.trim() || null })),
})
// Saved data back into the form (for admin review).
export const teamForm = (d) => ({
  age_group: d.age_group || '', season: d.season ?? '', coach: d.coach ? (KNOWN_COACHES.includes(d.coach) ? d.coach : NEW) : '', newCoach: d.coach && !KNOWN_COACHES.includes(d.coach) ? d.coach : '',
  squad: (d.squad || []).map((p) => ({ name: p.name || '', batch: p.batch ?? '', role: p.role || '', country: p.country || 'Sri Lanka' })),
  achievements: (d.achievements || []).map((a) => ({ title: a.title || '', finish: a.finish || '', custom: !!a.title && !isListed(d.age_group, a.title) })),
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
        <legend>Achievements</legend>
        <p className="small muted">Add each tournament or trophy match, and how the team finished.</p>
        <div className="rowlist">
          {t.achievements.map((a, i) => (
            <div key={i} className="rowcard">
              <span className="rownum">{i + 1}</span>
              <div className="rowcard-body"><div className="rowcard-line">
                <CompetitionSelect ageGroup={t.age_group} value={a.title} custom={a.custom} label={`Achievement ${i + 1}`}
                  onChange={({ title, custom }) => setRow('achievements', i, { title, custom, finish: resultsFor(title, t.age_group).includes(a.finish) ? a.finish : '' })} />
                <select className="mid" aria-label={`Achievement ${i + 1} result`} value={a.finish} onChange={(e) => setRow('achievements', i, { finish: e.target.value })}>
                  <option value="">Result…</option>
                  {resultsFor(a.title, t.age_group).map((r) => <option key={r}>{r}</option>)}
                </select>
              </div></div>
              <Remove label={`Remove achievement ${i + 1}`} onClick={() => set({ achievements: t.achievements.filter((_, j) => j !== i) })} />
            </div>
          ))}
        </div>
        <button type="button" className="ghost add-btn" onClick={() => set({ achievements: [...t.achievements, { title: '', finish: '', custom: false }] })}><Plus /> Add achievement</button>
      </fieldset>
    </>
  )
}
