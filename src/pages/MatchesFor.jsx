import { useParams } from 'react-router-dom'
import { useData } from '../App.jsx'
import { MatchTable, RecordLine } from '../components.jsx'

// Head-to-head against an opponent, or every match at a venue — across all age groups and years.
export function MatchesFor({ kind }) {
  const { id } = useParams()
  const { db } = useData()
  const item = kind === 'opponent' ? db.opponent[id] : db.venue[id]
  if (!item) return <p>Not found.</p>
  const matches = db.matches.filter((m) => m[`${kind}_id`] === id)
  return (
    <>
      <h1>{kind === 'opponent' ? `Royal College vs ${item.name}` : item.name}</h1>
      {kind === 'venue' && <p className="muted">{[item.city, item.surface].filter(Boolean).join(' · ')}</p>}
      <RecordLine matches={matches} />
      <MatchTable db={db} matches={matches} showTeam />
    </>
  )
}
