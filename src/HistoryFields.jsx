import { AGE_GROUPS, COUNTRIES, HOCKEY_HONOURS, MAX_YEARS, ordinal, rolesFor } from './data/db.js'

// Shared by the public Submit form and the admin player form.
// value = { teams: { U13: [{ year, role }] }, honours: { 'Royal Colours': [{ year }], Other: [{ year, text }] } }
// A group is ticked when its key exists.

export const emptyHistory = () => ({ teams: {}, honours: {} })
const thisYear = new Date().getFullYear()

export function validateHistory(h, { joined, batch } = {}) {
  const errs = []
  const check = (label, r) => {
    const y = +r.year
    if (!r.year) return errs.push(`${label}: enter the year`)
    if (!Number.isInteger(y) || y < 1835 || y > thisYear) return errs.push(`${label}: ${r.year} isn't a valid year`)
    if (batch && y > +batch) errs.push(`${label}: ${y} is after the batch year (${batch})`)
    if (joined && y < +joined) errs.push(`${label}: ${y} is before he joined (${joined})`)
  }
  for (const [g, rows] of Object.entries(h.teams)) {
    rows.forEach((r, i) => check(`${g}, ${ordinal(i + 1)} year`, r))
    const ys = rows.map((r) => r.year).filter(Boolean)
    if (new Set(ys).size !== ys.length) errs.push(`${g}: the same year is entered twice`)
  }
  for (const [t, rows] of Object.entries(h.honours)) {
    rows.forEach((r, i) => {
      check(`${t}, ${ordinal(i + 1)} entry`, r)
      if (t === 'Other' && !r.text?.trim()) errs.push(`Other achievement ${i + 1}: describe it`)
    })
    const ys = rows.map((r) => r.year).filter(Boolean)
    if (t !== 'Other' && new Set(ys).size !== ys.length) errs.push(`${t}: the same year is entered twice`)
  }
  return errs
}

function Counter({ n, set }) {
  return (
    <div className="counter" role="group" aria-label="Number of years">
      <button type="button" className="ghost" aria-label="Fewer" onClick={() => set(Math.max(1, n - 1))} disabled={n <= 1}>−</button>
      <span aria-live="polite">{n} {n === 1 ? 'year' : 'years'}</span>
      <button type="button" className="ghost" aria-label="More" onClick={() => set(Math.min(MAX_YEARS, n + 1))} disabled={n >= MAX_YEARS}>+</button>
    </div>
  )
}

function Group({ title, ticked, onTick, rows, onRows, blank, renderRow }) {
  const resize = (n) => onRows(rows.length > n ? rows.slice(0, n) : [...rows, ...Array.from({ length: n - rows.length }, blank)])
  return (
    <div className={`hgroup ${ticked ? 'on' : ''}`}>
      <label className="hgroup-head">
        <input type="checkbox" checked={ticked} onChange={(e) => onTick(e.target.checked)} />
        <span>{title}</span>
        {ticked && <Counter n={rows.length} set={resize} />}
      </label>
      {ticked && <div className="hrows">{rows.map((r, i) => renderRow(r, i, (patch) => onRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)))))}</div>}
    </div>
  )
}

const YearInput = ({ value, onChange, label }) => (
  <input className="year" type="number" inputMode="numeric" min="1835" max={thisYear} placeholder="Year" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
)

export default function HistoryFields({ value, onChange }) {
  const setTeams = (g, rows) => {
    const teams = { ...value.teams }
    if (rows) teams[g] = rows; else delete teams[g]
    onChange({ ...value, teams })
  }
  const setHon = (t, rows) => {
    const honours = { ...value.honours }
    if (rows) honours[t] = rows; else delete honours[t]
    onChange({ ...value, honours })
  }
  return (
    <>
      <fieldset className="hset">
        <legend>Hockey teams</legend>
        <p className="small muted">Tick each team he played in, choose how many years, then enter each year.</p>
        <div className="hgrid">
          {AGE_GROUPS.map((g) => (
            <Group key={g} title={g === '1st XI' ? '1st XI' : `${g} team`} ticked={!!value.teams[g]} rows={value.teams[g] || []}
              onTick={(on) => setTeams(g, on ? [{ year: '', role: '' }] : null)} onRows={(rows) => setTeams(g, rows)} blank={() => ({ year: '', role: '' })}
              renderRow={(r, i, patch) => (
                <div key={i} className="hrow">
                  <span className="hrow-n">{ordinal(i + 1)}</span>
                  <YearInput value={r.year} onChange={(year) => patch({ year })} label={`${g} ${ordinal(i + 1)} year`} />
                  <div className="chips">
                    {rolesFor(g).map((role) => (
                      <button type="button" key={role} className={`chip ${r.role === role ? 'on' : ''}`} aria-pressed={r.role === role} onClick={() => patch({ role: r.role === role ? '' : role })}>{role}</button>
                    ))}
                  </div>
                </div>
              )} />
          ))}
        </div>
      </fieldset>

      <fieldset className="hset">
        <legend>Hockey achievements</legend>
        <p className="small muted">For Royal Colours, enter each year he received them. They'll show as 1st Year Coloursman, 2nd Year Coloursman and so on.</p>
        <div className="hgrid">
          {HOCKEY_HONOURS.map((t) => (
            <Group key={t} title={t} ticked={!!value.honours[t]} rows={value.honours[t] || []}
              onTick={(on) => setHon(t, on ? [t === 'Other' ? { year: '', text: '' } : { year: '' }] : null)} onRows={(rows) => setHon(t, rows)}
              blank={() => (t === 'Other' ? { year: '', text: '' } : { year: '' })}
              renderRow={(r, i, patch) => (
                <div key={i} className="hrow">
                  <span className="hrow-n">{ordinal(i + 1)}</span>
                  <YearInput value={r.year} onChange={(year) => patch({ year })} label={`${t} ${ordinal(i + 1)} year`} />
                  {t === 'Other' && <input className="grow" placeholder="e.g. Best goalkeeper, Schools Nationals" value={r.text} onChange={(e) => patch({ text: e.target.value })} aria-label="Achievement" />}
                  {t === 'Royal Colours' && r.year && <span className="pill gold">{ordinal([...value.honours[t]].filter((x) => x.year).sort((a, b) => a.year - b.year).indexOf(r) + 1)} Year Coloursman</span>}
                </div>
              )} />
          ))}
        </div>
      </fieldset>
    </>
  )
}

// Basic player details, shared by Submit and Admin.
export const emptyPlayer = () => ({ full_name: '', known_as: '', joined_year: '', batch: '', residence_country: 'Sri Lanka', other_sports: '', bio: '' })

export function validatePlayer(p) {
  const errs = []
  if (p.full_name.trim().length < 2) errs.push('Full name: enter his name')
  for (const [k, l] of [['joined_year', 'Year he joined Royal'], ['batch', 'Batch (year he left Royal)']]) {
    if (p[k] && (!Number.isInteger(+p[k]) || +p[k] < 1835 || +p[k] > thisYear + 1)) errs.push(`${l}: ${p[k]} isn't a valid year`)
  }
  if (p.joined_year && p.batch && +p.joined_year > +p.batch) errs.push('The year he joined is after the year he left')
  return errs
}

// Clean values ready for the players table.
export const playerRow = (p) => ({
  full_name: p.full_name.trim(), known_as: p.known_as.trim() || null,
  joined_year: p.joined_year ? +p.joined_year : null, batch: p.batch ? +p.batch : null, residence_country: p.residence_country || 'Sri Lanka',
  other_sports: p.other_sports.split(',').map((s) => s.trim()).filter(Boolean), bio: p.bio.trim() || null,
})

export function PlayerBasics({ value, onChange, bioLabel = 'Anything else about him' }) {
  const f = (k) => ({ value: value[k], onChange: (e) => onChange({ ...value, [k]: e.target.value }) })
  return (
    <>
      <div className="two">
        <label>Full name *<input {...f('full_name')} placeholder="Senuda Weliwatta" /></label>
        <label>Known as<input {...f('known_as')} placeholder="Nickname, if any" /></label>
      </div>
      <div className="two">
        <label>Year he joined Royal<input type="number" inputMode="numeric" {...f('joined_year')} placeholder="2008" /></label>
        <label>Batch (year he left Royal)<input type="number" inputMode="numeric" {...f('batch')} placeholder="2021" /></label>
      </div>
      <label>Country he lives in now
        <select {...f('residence_country')}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select>
      </label>
      <label>Other sports at Royal (comma separated)<input {...f('other_sports')} placeholder="Boxing, Athletics" /></label>
      <label>{bioLabel}<textarea rows="3" {...f('bio')} /></label>
    </>
  )
}
