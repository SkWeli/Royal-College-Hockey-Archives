import { AGE_GROUPS, ageLabel, COUNTRIES, HOCKEY_ACHIEVEMENTS, MAX_YEARS, OTHER_ACHIEVEMENTS, SPORTS, SPORT_COLOUR_ROLES, ordinal, rolesFor } from './data/db.js'

// Shared by the public Submit form and the admin player form.
// value = {
//   teams:   { U13: [{ year, role }] },
//   honours: { 'Royal Colours': [{ year }], 'Colombo Schools Colours': [{ year, role }], Other: [{ year, text }] },   ← hockey
//   other:   { 'Royal Crown': [{ year }], 'Senior Prefect': [{ year, role }] },
//   sports:  [{ sport: 'Rugby', otherSport: '', rows: [{ year, role }] }],                                          ← colours in other sports
// }
// A group is ticked when its key exists.

export const emptyHistory = () => ({ teams: {}, honours: {}, other: {}, sports: [] })
// Older submissions kept Royal Crown with the hockey achievements; move it to Other achievements.
export function normalizeHistory(h = {}) {
  const { 'Royal Crown': crown, ...honours } = h.honours || {}
  return { teams: h.teams || {}, honours, other: { ...(crown ? { 'Royal Crown': crown } : {}), ...(h.other || {}) }, sports: h.sports || [] }
}
const thisYear = new Date().getFullYear()
// Players sometimes play one season after their batch year, so allow batch + 1.
const GRACE = 1

export function validateHistory(h, { joined, batch } = {}) {
  const errs = []
  const check = (label, r) => {
    const y = +r.year
    if (!r.year) return errs.push(`${label}: enter the year`)
    if (!Number.isInteger(y) || y < 1835 || y > thisYear) return errs.push(`${label}: ${r.year} isn't a valid year`)
    if (batch && y > +batch + GRACE) errs.push(`${label}: ${y} is more than a year after the batch year (${batch})`)
    if (joined && y < +joined) errs.push(`${label}: ${y} is before he joined (${joined})`)
  }
  const noRepeats = (label, rows) => {
    const ys = rows.map((r) => r.year).filter(Boolean)
    if (new Set(ys).size !== ys.length) errs.push(`${label}: the same year is entered twice`)
  }
  for (const [g, rows] of Object.entries(h.teams)) { rows.forEach((r, i) => check(`${g}, ${ordinal(i + 1)} year`, r)); noRepeats(g, rows) }
  for (const [t, rows] of [...Object.entries(h.honours), ...Object.entries(h.other || {})]) {
    rows.forEach((r, i) => {
      check(`${t}, ${ordinal(i + 1)} entry`, r)
      if (t === 'Other' && !r.text?.trim()) errs.push(`Other hockey achievement ${i + 1}: describe it`)
    })
    if (t !== 'Other') noRepeats(t, rows)
  }
  const seen = new Set()
  ;(h.sports || []).forEach((s, i) => {
    const name = s.sport === 'Other' ? s.otherSport?.trim() : s.sport
    if (!name) return errs.push(`Other sport ${i + 1}: choose the sport`)
    if (seen.has(name.toLowerCase())) errs.push(`${name}: listed twice`)
    seen.add(name.toLowerCase())
    s.rows.forEach((r, j) => check(`${name} colours, ${ordinal(j + 1)} year`, r))
    noRepeats(`${name} colours`, s.rows)
  })
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

const resized = (rows, n, blank) => (rows.length > n ? rows.slice(0, n) : [...rows, ...Array.from({ length: n - rows.length }, blank)])

function Group({ title, ticked, onTick, rows, onRows, blank, renderRow, head }) {
  return (
    <div className={`hgroup ${ticked ? 'on' : ''}`}>
      <label className="hgroup-head">
        <input type="checkbox" checked={ticked} onChange={(e) => onTick(e.target.checked)} />
        <span>{title}</span>
        {ticked && <Counter n={rows.length} set={(n) => onRows(resized(rows, n, blank))} />}
      </label>
      {ticked && head}
      {ticked && <div className="hrows">{rows.map((r, i) => renderRow(r, i, (patch) => onRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)))))}</div>}
    </div>
  )
}

const YearInput = ({ value, onChange, label }) => (
  <input className="year" type="number" inputMode="numeric" min="1835" max={thisYear} placeholder="Year" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
)

const Chips = ({ options, value, onChange }) => (
  <div className="chips">
    {options.map((o) => <button type="button" key={o} className={`chip ${value === o ? 'on' : ''}`} aria-pressed={value === o} onClick={() => onChange(value === o ? '' : o)}>{o}</button>)}
  </div>
)

// The numbered badge next to a colours year, e.g. "2nd Year Coloursman".
function OrdinalBadge({ rows, r }) {
  if (!r.year) return null
  const n = rows.filter((x) => x.year).sort((a, b) => a.year - b.year).indexOf(r) + 1
  return <span className="pill gold">{ordinal(n)} Year Coloursman</span>
}

// One ticked group of achievements (Royal Colours, Senior Prefect…).
function AchievementGroups({ groups, value, setGroup }) {
  return groups.map((g) => {
    const blank = () => (g.text ? { year: '', text: '' } : { year: '', role: '' })
    const rows = value[g.key] || []
    return (
      <Group key={g.key} title={g.key === 'Other' ? 'Other hockey achievement' : g.key} ticked={!!value[g.key]} rows={rows}
        onTick={(on) => setGroup(g.key, on ? [blank()] : null)} onRows={(rs) => setGroup(g.key, rs)} blank={blank}
        renderRow={(r, i, patch) => (
          <div key={i} className="hrow">
            <span className="hrow-n">{ordinal(i + 1)}</span>
            <YearInput value={r.year} onChange={(year) => patch({ year })} label={`${g.key} ${ordinal(i + 1)} year`} />
            {g.text && <input className="grow" placeholder="e.g. Best goalkeeper, Schools Nationals" value={r.text} onChange={(e) => patch({ text: e.target.value })} aria-label="Achievement" />}
            {g.ordinal && <OrdinalBadge rows={rows} r={r} />}
            {g.roles && <Chips options={g.roles} value={r.role} onChange={(role) => patch({ role })} />}
          </div>
        )} />
    )
  })
}

export default function HistoryFields({ value, onChange }) {
  const v = { other: {}, sports: [], ...value }
  const setIn = (part) => (k, rows) => {
    const next = { ...v[part] }
    if (rows) next[k] = rows; else delete next[k]
    onChange({ ...v, [part]: next })
  }
  const setSports = (sports) => onChange({ ...v, sports })
  const setSport = (i, patch) => setSports(v.sports.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const usedSports = v.sports.map((s) => s.sport)

  return (
    <>
      <fieldset className="hset">
        <legend>Hockey teams</legend>
        <p className="small muted">Tick each team he played in, choose how many years, then enter each year.</p>
        <div className="hgrid">
          {AGE_GROUPS.map((g) => (
            <Group key={g} title={g === '1st XI' ? '1st XI' : `${ageLabel(g)} team`} ticked={!!v.teams[g]} rows={v.teams[g] || []}
              onTick={(on) => setIn('teams')(g, on ? [{ year: '', role: '' }] : null)} onRows={(rows) => setIn('teams')(g, rows)} blank={() => ({ year: '', role: '' })}
              renderRow={(r, i, patch) => (
                <div key={i} className="hrow">
                  <span className="hrow-n">{ordinal(i + 1)}</span>
                  <YearInput value={r.year} onChange={(year) => patch({ year })} label={`${g} ${ordinal(i + 1)} year`} />
                  <Chips options={rolesFor(g)} value={r.role} onChange={(role) => patch({ role })} />
                </div>
              )} />
          ))}
        </div>
      </fieldset>

      <fieldset className="hset">
        <legend>Hockey achievements</legend>
        <p className="small muted">Tick each one, choose how many years, then enter each year. Royal Colours show as 1st Year Coloursman, 2nd Year Coloursman and so on.</p>
        <div className="hgrid"><AchievementGroups groups={HOCKEY_ACHIEVEMENTS} value={v.honours} setGroup={setIn('honours')} /></div>
      </fieldset>

      <fieldset className="hset">
        <legend>Other achievements</legend>
        <div className="hgrid">
          <AchievementGroups groups={OTHER_ACHIEVEMENTS} value={v.other} setGroup={setIn('other')} />
          {v.sports.map((s, i) => (
            <Group key={i} title={<>Colours in another sport</>} ticked rows={s.rows}
              onTick={(on) => !on && setSports(v.sports.filter((_, j) => j !== i))} onRows={(rows) => setSport(i, { rows })} blank={() => ({ year: '', role: '' })}
              head={(
                <div className="hrows" style={{ paddingBottom: 0 }}>
                  <div className="hrow">
                    <label className="inline">Sport
                      <select value={s.sport} onChange={(e) => setSport(i, { sport: e.target.value })} aria-label={`Other sport ${i + 1}`}>
                        <option value="">Choose a sport…</option>
                        {SPORTS.map((sp) => <option key={sp} disabled={sp !== s.sport && usedSports.includes(sp)}>{sp}</option>)}
                        <option value="Other">Other (type it)</option>
                      </select>
                    </label>
                    {s.sport === 'Other' && <input className="grow" placeholder="Sport" aria-label={`Other sport ${i + 1} name`} value={s.otherSport} onChange={(e) => setSport(i, { otherSport: e.target.value })} />}
                  </div>
                </div>
              )}
              renderRow={(r, j, patch) => (
                <div key={j} className="hrow">
                  <span className="hrow-n">{ordinal(j + 1)}</span>
                  <YearInput value={r.year} onChange={(year) => patch({ year })} label={`Other sport ${i + 1} ${ordinal(j + 1)} year`} />
                  <OrdinalBadge rows={s.rows} r={r} />
                  <Chips options={SPORT_COLOUR_ROLES} value={r.role} onChange={(role) => patch({ role })} />
                </div>
              )} />
          ))}
          <button type="button" className="ghost add-btn" onClick={() => setSports([...v.sports, { sport: '', otherSport: '', rows: [{ year: '', role: '' }] }])}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg> Add colours in another sport
          </button>
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
      <div className="two">
        <label>Country he lives in now
          <select {...f('residence_country')}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label>Other sports at Royal (comma separated)<input {...f('other_sports')} placeholder="Boxing, Athletics" /></label>
      </div>
      <label>{bioLabel}<textarea rows="3" {...f('bio')} /></label>
    </>
  )
}
